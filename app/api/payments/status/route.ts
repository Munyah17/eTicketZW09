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
          // Only generate ticket if one doesn't exist yet (idempotency)
          const existingTicket = await PaymentService.getTicketByPaymentReference(reference);
          if (!existingTicket) {
            const m = (payment.metadata ?? {}) as Record<string, unknown>;
            await generateTicket({
              paymentId: reference,
              eventId: (m.eventId as string) || "",
              ticketTypeId: (m.ticketTypeId as string) || "",
              ticketTypeName: m.ticketTypeName as string | undefined,
              eventTitle: m.eventTitle as string | undefined,
              eventDate: m.eventDate as string | undefined,
              eventTime: m.eventTime as string | undefined,
              venue: m.venue as string | undefined,
              buyerName: (m.buyerName as string) || "",
              buyerEmail: (m.buyerEmail as string) || "",
              buyerPhone: (m.buyerPhone as string) || "",
              displayName: m.displayName as string | undefined,
              quantity: m.quantity as number | undefined,
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
