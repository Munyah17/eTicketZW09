import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("ref");

  if (!reference) {
    return NextResponse.json(
      { error: "Missing payment reference (ref)" },
      { status: 400 }
    );
  }

  const ticket = PaymentService.getTicketByPaymentReference(reference);
  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found for this payment reference", reference },
      { status: 404 }
    );
  }

  const payment = PaymentService.getPayment(reference);

  // Normalize to the shape the confirmation page expects
  return NextResponse.json({
    success: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.eventId,
      eventTitle: ticket.eventTitle,
      eventDate: ticket.eventDate,
      eventTime: ticket.eventTime,
      venue: ticket.venue,
      ticketType: ticket.ticketTypeName,
      quantity: payment?.metadata?.quantity ?? 1,
      buyerName: ticket.buyerName,
      buyerContact: ticket.buyerContact,
      displayName: ticket.buyerDisplayName,
      paymentMethod: ticket.paymentMethod,
      totalPaid: ticket.totalPaid,
      currency: ticket.currency,
      purchasedAt: ticket.purchasedAt,
    },
  });
}
