import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { PaymentService } from "@/lib/services/payment-service";
import { sendBankTransferDecision } from "@/lib/bank-transfer-notifications";
import { logError } from "@/lib/error-logger";

// Manual review of an on-hold bank transfer order. The admin has checked
// the FBC statement (and the buyer's uploaded proof / transaction ref) and
// now decides:
//   approve → run the full fulfillment workflow (ticket issued + delivered)
//   reject  → mark failed with a reason; buyer told what went wrong
//   stall   → keep on hold, request more information; buyer told what to fix
// Every decision notifies the buyer on email AND WhatsApp.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  const reason = String(body.reason ?? "").trim();

  if (!action || !["approve", "reject", "stall"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', or 'stall'" },
      { status: 400 }
    );
  }
  if ((action === "reject" || action === "stall") && !reason) {
    return NextResponse.json(
      { error: "A reason is required so the buyer knows what to fix" },
      { status: 400 }
    );
  }

  const payment = await PaymentService.getPayment(reference);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.provider !== "bank_transfer") {
    return NextResponse.json({ error: "Not a bank transfer payment" }, { status: 400 });
  }
  if (payment.status !== "on_hold") {
    return NextResponse.json(
      { error: `This order is no longer on hold (status: ${payment.status})` },
      { status: 409 }
    );
  }

  const supabase = createAdminClient();
  const m = (payment.metadata ?? {}) as Record<string, unknown>;
  const notifyInfo = {
    reference,
    eventTitle: m.eventTitle as string | undefined,
    buyerName: m.buyerName as string | undefined,
    buyerEmail: m.buyerEmail as string | undefined,
    buyerPhone: m.buyerPhone as string | undefined,
    amount: payment.amount,
    currency: payment.currency,
    transactionReference: m.transaction_reference as string | undefined,
    reason: reason || undefined,
  };
  const reviewedAt = new Date().toISOString();

  try {
    if (action === "approve") {
      // Full fulfillment — marks paid, mints the ticket, pushes it to the
      // buyer's email + WhatsApp (that push IS the approval notification
      // payload), then the explicit decision message goes out on top.
      await PaymentService.confirmPaid(reference, { paymentMethod: "bank_transfer" });
      await supabase
        .from("payments")
        .update({ review_status: "approved", review_reason: null, reviewed_at: reviewedAt, reviewed_by: auth.user.id })
        .eq("reference", reference);
      after(() => sendBankTransferDecision("approved", notifyInfo).catch(() => {}));
    } else if (action === "reject") {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          error_message: `Bank transfer rejected: ${reason}`,
          review_status: "rejected",
          review_reason: reason,
          reviewed_at: reviewedAt,
          reviewed_by: auth.user.id,
        })
        .eq("reference", reference);
      after(() => sendBankTransferDecision("rejected", notifyInfo).catch(() => {}));
    } else {
      // stall — stays on_hold, buyer told what to fix and can resubmit
      await supabase
        .from("payments")
        .update({
          review_status: "info_requested",
          review_reason: reason,
          reviewed_at: reviewedAt,
          reviewed_by: auth.user.id,
          metadata: { ...m, review_status: "info_requested" },
        })
        .eq("reference", reference);
      after(() => sendBankTransferDecision("info_requested", notifyInfo).catch(() => {}));
    }

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: `payment.bank_transfer_${action}`,
      resource_type: "payment",
      resource_id: reference,
      details: {
        amount: payment.amount,
        currency: payment.currency,
        reason: reason || null,
        transaction_reference: m.transaction_reference ?? null,
        event_title: m.eventTitle ?? null,
      },
    });

    const updated = await PaymentService.getPayment(reference);
    return NextResponse.json({
      success: true,
      status: updated?.status,
      reviewStatus: updated?.reviewStatus,
      message:
        action === "approve"
          ? "Payment verified — ticket issued and buyer notified"
          : action === "reject"
          ? "Order rejected — buyer notified with the reason"
          : "More information requested — buyer notified",
    });
  } catch (error) {
    logError("bank_transfer_review_failed", error, { reference, action });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review failed" },
      { status: 500 }
    );
  }
}
