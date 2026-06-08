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

  const [ticket, payment] = await Promise.all([
    PaymentService.getTicketByPaymentReference(reference),
    PaymentService.getPayment(reference),
  ]);

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found for this payment reference", reference },
      { status: 404 }
    );
  }

  // DB rows are snake_case — map to the shape the confirmation page expects
  return NextResponse.json({
    success: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.event_id,
      eventTitle: ticket.event_title,
      eventDate: ticket.event_date,
      eventTime: ticket.event_time,
      venue: ticket.venue,
      ticketType: ticket.ticket_type_name,
      quantity: (payment?.metadata as Record<string, unknown> | undefined)?.quantity ?? 1,
      buyerName: ticket.buyer_name,
      buyerContact: ticket.buyer_contact,
      displayName: ticket.buyer_display_name,
      paymentMethod: ticket.payment_method,
      totalPaid: ticket.total_paid,
      currency: ticket.currency,
      purchasedAt: ticket.purchased_at,
    },
  });
}
