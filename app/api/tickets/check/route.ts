import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, normalizeTicketCode } from "@/lib/validation";

// Public, read-only ticket confirmation check — the page a phone camera lands
// on when scanning the QR printed on a ticket. Confirms authenticity and
// current status without exposing buyer contact details and without ever
// mutating the ticket (admission itself stays behind staff auth in
// /api/validate and /api/organizer/gate).
export async function GET(req: NextRequest) {
  const code = normalizeTicketCode(req.nextUrl.searchParams.get("code") || "");
  if (!code || !isUuid(code)) {
    return NextResponse.json({ status: "invalid", message: "Invalid ticket code." });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, event_title, event_date, event_time, venue, ticket_type_name, seat_number, buyer_display_name, validated, validated_at, payment_status")
    .eq("id", code)
    .maybeSingle();

  if (!ticket || ticket.payment_status !== "completed") {
    return NextResponse.json({ status: "invalid", message: "No valid ticket found for this code." });
  }

  const shared = {
    ticket: {
      id: ticket.id,
      eventTitle: ticket.event_title,
      eventDate: ticket.event_date,
      eventTime: ticket.event_time,
      venue: ticket.venue,
      ticketTypeName: ticket.ticket_type_name,
      seatNumber: ticket.seat_number,
      holder: ticket.buyer_display_name,
    },
  };

  if (ticket.validated) {
    return NextResponse.json({
      status: "used",
      message: `This ticket was already used on ${new Date(ticket.validated_at).toLocaleString()}.`,
      ...shared,
    });
  }

  return NextResponse.json({
    status: "valid",
    message: "This ticket is genuine and has not been used.",
    ...shared,
  });
}
