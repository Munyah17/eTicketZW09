import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Session-scoped (RLS: organizer can only see/update tickets for their own
// events) — used by the gate check-in page for both listing an event's
// tickets and validating/admitting a scanned or manually entered code.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const { data, error } = await supabase.from("tickets").select("*").eq("event_id", eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, eventId, code, ticketId } = body;

  if (action === "scan") {
    if (!eventId || !code) return NextResponse.json({ error: "eventId and code are required" }, { status: 400 });

    const { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .eq("qr_code", code)
      .maybeSingle();

    if (!ticket) {
      return NextResponse.json({ status: "not_found", message: "Ticket not found or not valid for this event" });
    }
    if (ticket.is_admitted) {
      return NextResponse.json({
        status: "admitted",
        ticket,
        message: `Already admitted at ${new Date(ticket.admitted_at).toLocaleTimeString()}`,
      });
    }
    if (ticket.payment_status !== "completed") {
      return NextResponse.json({ status: "invalid", ticket, message: "Payment not completed" });
    }
    return NextResponse.json({ status: "valid", ticket, message: "Valid ticket - Ready for admission" });
  }

  if (action === "admit") {
    if (!ticketId) return NextResponse.json({ error: "ticketId is required" }, { status: 400 });

    // .eq("is_admitted", false) makes this an atomic check-and-set — if two
    // scans race on the same ticket, only the first can flip it, closing the
    // window where the same ticket could be waved through twice.
    const { data: ticket, error } = await supabase
      .from("tickets")
      .update({ is_admitted: true, admitted_at: new Date().toISOString(), admitted_by: user.id, validated: true, validated_at: new Date().toISOString(), validated_by: user.id })
      .eq("id", ticketId)
      .eq("is_admitted", false)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!ticket) {
      const { data: current } = await supabase.from("tickets").select("*").eq("id", ticketId).single();
      return NextResponse.json({
        status: "admitted",
        ticket: current,
        message: current ? `Already admitted at ${new Date(current.admitted_at).toLocaleTimeString()}` : "Ticket not found.",
      });
    }

    return NextResponse.json({ status: "admitted", ticket, message: "Successfully admitted!" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
