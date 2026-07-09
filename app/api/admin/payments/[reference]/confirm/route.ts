import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { PaymentService } from "@/lib/services/payment-service";
import { logError } from "@/lib/error-logger";

// Manual override for when a real Stripe/Paynow webhook hasn't confirmed a
// payment (e.g. STRIPE_WEBHOOK_SECRET isn't configured yet). An admin who has
// checked the provider's own dashboard tells the app the outcome directly.
//
// CRITICAL: This endpoint must execute the ENTIRE fulfillment workflow:
// 1. Mark payment as paid
// 2. Generate ticket
// 3. Save ticket to database
// 4. Generate QR code
// 5. Send ticket email with attachment
// 6. Send sale notifications
// Only then is the process complete.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;

  console.log("Manual payment confirmation:", reference, status);

  if (status !== "paid" && status !== "failed") {
    return NextResponse.json({ error: "status must be 'paid' or 'failed'" }, { status: 400 });
  }

  const payment = await PaymentService.getPayment(reference);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const supabase = createAdminClient();

  try {
    if (status === "paid") {
      console.log("🚀 Starting fulfillment workflow for payment:", reference);
      await PaymentService.confirmPaid(reference, { paymentMethod: payment.provider });
      console.log("✅ Fulfillment workflow completed for payment:", reference);
    } else {
      console.log("❌ Marking payment as failed:", reference);
      await PaymentService.markFailed(reference);
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: status === "paid" ? "payment.manual_confirm" : "payment.manual_decline",
      resource_type: "payment",
      resource_id: reference,
      details: {
        previous_status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        fulfillment_status: "completed",
      },
    });

    const updated = await PaymentService.getPayment(reference);
    return NextResponse.json({
      success: true,
      status: updated?.status,
      message: status === "paid"
        ? "Payment confirmed and ticket fulfillment workflow executed"
        : "Payment marked as failed",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during payment confirmation";
    console.error("❌ ERROR during manual payment confirmation:", reference, error);

    logError("manual_payment_confirmation_failed", error, {
      reference,
      status,
      previousStatus: payment.status,
    });

    // Log the failed action
    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: "payment.manual_confirm_failed",
      resource_type: "payment",
      resource_id: reference,
      details: {
        previous_status: payment.status,
        error: errorMessage,
        amount: payment.amount,
        currency: payment.currency,
      },
    });

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: errorMessage,
        message: "Payment confirmation failed. Check error logs and payment metadata.",
      },
      { status: 500 }
    );
  }
}
