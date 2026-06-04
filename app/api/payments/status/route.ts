import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";
import { generateTicket } from "@/lib/ticket-generator";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("ref");

  if (!reference) {
    return NextResponse.json(
      { error: "Missing payment reference (ref)" },
      { status: 400 }
    );
  }

  const payment = PaymentService.getPayment(reference);
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
          // Only generate ticket if one doesn't exist yet (idempotency)
          const existingTicket = PaymentService.getTicketByPaymentReference(reference);
          if (!existingTicket) {
            await generateTicket({
              paymentId: reference,
              eventId: payment.metadata?.eventId || "",
              ticketTypeId: payment.metadata?.ticketTypeId || "",
              ticketTypeName: payment.metadata?.ticketTypeName,
              eventTitle: payment.metadata?.eventTitle,
              eventDate: payment.metadata?.eventDate,
              eventTime: payment.metadata?.eventTime,
              venue: payment.metadata?.venue,
              buyerName: payment.metadata?.buyerName || "",
              buyerEmail: payment.metadata?.buyerEmail || "",
              buyerPhone: payment.metadata?.buyerPhone || "",
              displayName: payment.metadata?.displayName,
              quantity: payment.metadata?.quantity,
              amount: session.amount_total ? session.amount_total / 100 : payment.amount,
              currency: (session.currency || payment.currency).toUpperCase(),
              paymentMethod: "stripe",
            });
          }
          await PaymentService.updatePaymentStatus(reference, "paid");
        } else if (res.ok && session.status === "expired") {
          await PaymentService.updatePaymentStatus(reference, "failed");
        }
      } catch (err) {
        console.error("Direct Stripe verification error:", err);
        // Non-fatal: fall through and return current status
      }
    }
  }

  // Re-read payment after possible update above
  const updated = PaymentService.getPayment(reference)!;

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
