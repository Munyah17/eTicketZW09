import { NextRequest, NextResponse } from "next/server";
import { PaymentService, PaynowService, EcocashService } from "@/lib/services/payment-service";
import { logError } from "@/lib/error-logger";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("ref");

  if (!reference) {
    return NextResponse.json(
      { error: "Missing payment reference (ref)" },
      { status: 400 }
    );
  }

  const payment = await PaymentService.getPayment(reference);
  if (!payment) {
    return NextResponse.json(
      { error: "Payment not found", reference },
      { status: 404 }
    );
  }

  // Same for Paynow: when the buyer lands back on the confirmation page while
  // the payment is still pending (webhook delayed or missed), verify directly
  // with Paynow's servers and complete fulfillment right here.
  if (payment.status === "pending" && payment.provider === "paynow") {
    const pollUrl = payment.metadata?.paynow_poll_url as string | undefined;
    if (pollUrl) {
      try {
        const verified = await PaynowService.pollStatus(pollUrl);
        if (verified === "paid") {
          await PaymentService.confirmPaid(reference, {
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: "paynow",
          });
        } else if (verified === "failed") {
          await PaymentService.markFailed(reference);
        }
      } catch (err) {
        logError("paynow_status_poll_failed", err, { reference });
        // Non-fatal: fall through and return current status
      }
    }
  }

  // Same for EcoCash Instant Payment: there's no redirect page at all here —
  // the buyer approves a USSD PIN prompt on their phone — so this poll is
  // often the *first* time we learn the outcome, not just a fallback.
  if (payment.status === "pending" && payment.provider === "ecocash") {
    const endUserId = payment.metadata?.ecocash_end_user_id as string | undefined;
    if (endUserId) {
      try {
        const verified = await EcocashService.pollStatus(endUserId, reference);
        if (verified === "paid") {
          await PaymentService.confirmPaid(reference, {
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: "ecocash",
          });
        } else if (verified === "failed") {
          await PaymentService.markFailed(reference);
        }
      } catch (err) {
        logError("ecocash_status_poll_failed", err, { reference });
        // Non-fatal: fall through and return current status
      }
    }
  }

  // Re-read payment after possible update above
  const updated = (await PaymentService.getPayment(reference))!;

  // on_hold (bank transfer) is deliberately not in the instruction ladder —
  // there is no gateway to poll, only an admin's manual decision can move it.
  const instruction =
    updated.status === "paid"
      ? "accept"
      : updated.status === "failed" || updated.status === "refunded"
      ? "retry"
      : "pending";

  const message =
    updated.status === "paid"
      ? "Payment confirmed. Accept the payment and generate the ticket."
      : updated.status === "failed"
      ? "Payment failed. Decline this checkout and ask the user to try again."
      : updated.status === "refunded"
      ? "This payment was refunded. Any ticket issued for it is no longer valid."
      : updated.status === "on_hold"
      ? "Bank transfer order is on hold pending manual verification."
      : "Payment is still pending. Wait for confirmation before generating a ticket.";

  // Never return the raw payment metadata — it carries buyer PII (name, email,
  // phone, ID numbers, attendee details, custom-field answers). This endpoint
  // is public (anyone holding the reference can call it), so expose only the
  // two non-PII fields the confirmation page actually reads: the event id
  // (retry link) and the bank-transfer reference on file.
  const md = (updated.metadata ?? null) as Record<string, unknown> | null;
  const safeMetadata = md
    ? {
        eventId: (md.eventId as string) ?? null,
        transaction_reference: (md.transaction_reference as string) ?? null,
      }
    : null;

  // Split-payment orders: surface a safe order summary so the confirmation
  // page can tell the buyer their deposit landed and link them to pay the
  // balance. Only non-PII fields are exposed — the order reference alone
  // can't be used to pay without also knowing the buyer email.
  let order: { reference: string; status: string; total: number; amountPaid: number; balance: number } | null = null;
  const orderId = (md?.orderId as string) ?? null;
  if (orderId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: ord } = await createAdminClient()
      .from("ticket_orders")
      .select("reference, status, total, amount_paid, balance")
      .eq("id", orderId)
      .maybeSingle();
    if (ord) {
      order = {
        reference: ord.reference as string,
        status: ord.status as string,
        total: Number(ord.total),
        amountPaid: Number(ord.amount_paid),
        balance: Number(ord.balance),
      };
    }
  }

  return NextResponse.json({
    success: true,
    reference: updated.reference,
    provider: updated.provider,
    status: updated.status,
    reviewStatus: updated.reviewStatus ?? null,
    reviewReason: updated.reviewReason ?? null,
    error: updated.error || null,
    metadata: safeMetadata,
    order,
    instruction,
    message,
  });
}
