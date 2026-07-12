import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTicketPng } from "@/lib/ticket-png";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const png = await renderTicketPng({
    id: ticket.id,
    eventTitle: ticket.event_title,
    eventDate: ticket.event_date,
    eventTime: ticket.event_time,
    venue: ticket.venue,
    ticketTypeName: ticket.ticket_type_name,
    buyerName: ticket.buyer_name,
    buyerDisplayName: ticket.buyer_display_name,
    buyerEmail: ticket.buyer_email,
    totalPaid: Number(ticket.total_paid),
    currency: ticket.currency,
    paymentMethod: ticket.payment_method,
    purchasedAt: ticket.purchased_at,
    seatNumber: ticket.seat_number,
  });

  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="ticket-${ticket.id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
