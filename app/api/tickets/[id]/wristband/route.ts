import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderWristbandPng } from "@/lib/wristband-png";

// Same ticket, different printable format — a long adhesive-wristband strip
// instead of the full ticket card. Not a separate credential: the QR encodes
// the identical validation URL as the ticket PNG, so either format admits
// the holder. Gate staff hand out pre-printed wristbands as the default;
// this route just makes self-printing available too, per request.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, event_title, event_date, ticket_type_name")
    .eq("id", id)
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const png = await renderWristbandPng({
    id: ticket.id,
    eventTitle: ticket.event_title,
    eventDate: ticket.event_date,
    ticketTypeName: ticket.ticket_type_name,
  });

  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="wristband-${ticket.id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
