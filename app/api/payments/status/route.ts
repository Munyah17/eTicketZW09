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

  // If Stripe payment is still pending, verify directly with Stripe API.
  // This handles the case where the webhook hasn't fired yet (e.g. local dev).
  if (payment.status === "pending" && payment.provider === "stripe") {
    const stripeSessionId = payment.metadata?.stripe_session_id;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (stripeSessionId && stripeKey) {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${stripeSessionId}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } }
        );
        const session = await res.json();
        console.log("Direct Stripe session check:", session.id, session.status, session.payment_status);

        if (res.ok && (session.payment_status === "paid" || session.status === "complete")) {
          await PaymentService.confirmPaid(reference, {
            amount: session.amount_total ? session.amount_total / 100 : payment.amount,
            currency: (session.currency || payment.currency).toUpperCase(),
            paymentMethod: "stripe",
          });
        } else if (res.ok && session.status === "expired") {
          await PaymentService.markFailed(reference);
        }
      } catch (err) {
        console.error("Direct Stripe verification error:", err);
        // Non-fatal: fall through and return current status
      }
    }
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

  const instruction =
    updated.status === "paid"
      ? "accept"
      : updated.status === "failed"
      ? "retry"
      : "pending";

  const message =
    updated.status === "paid"
      ? "Payment confirmed. Accept the payment and generate the ticket."
      : updated.status === "failed"
      ? "Payment failed. Decline this checkout and ask the user to try again."
      : "Payment is still pending. Wait for confirmation before generating a ticket.";

  return NextResponse.json({
    success: true,
    reference: updated.reference,
    provider: updated.provider,
    status: updated.status,
    error: updated.error || null,
    metadata: updated.metadata || null,
    instruction,
    message,
  });
}
