import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { PaymentService } from "@/lib/services/payment-service";

// Manual override for when a real Stripe/Paynow webhook hasn't confirmed a
// payment (e.g. STRIPE_WEBHOOK_SECRET isn't configured yet). An admin who has
// checked the provider's own dashboard tells the app the outcome directly.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;

  if (status !== "paid" && status !== "failed") {
    return NextResponse.json({ error: "status must be 'paid' or 'failed'" }, { status: 400 });
  }

  const payment = await PaymentService.getPayment(reference);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (status === "paid") {
    await PaymentService.confirmPaid(reference, { paymentMethod: payment.provider });
  } else {
    await PaymentService.markFailed(reference);
  }

  const supabase = createAdminClient();
  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: status === "paid" ? "payment.manual_confirm" : "payment.manual_decline",
    resource_type: "payment",
    resource_id: reference,
    details: { previous_status: payment.status, amount: payment.amount, currency: payment.currency, provider: payment.provider },
  });

  const updated = await PaymentService.getPayment(reference);
  return NextResponse.json({ success: true, status: updated?.status });
}
