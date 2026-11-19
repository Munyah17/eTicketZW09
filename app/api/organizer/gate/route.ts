import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, normalizeTicketCode } from "@/lib/validation";

// Session-scoped gate — an organizer can only see/admit tickets for their own
// events; a super admin can access any event for technical support. All ticket
// reads and writes go through the admin client (service role) because the
// tickets table no longer grants INSERT/UPDATE to authenticated users —
// ownership is enforced explicitly here instead of relying on RLS.
async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.is_suspended) return null;
  return { userId: user.id, role: profile.role as string };
}

// Columns safe to return to the gate UI — excludes buyer_email, qr_code,
// custom_field_responses and other payment internals admission doesn't need.
const GATE_TICKET_COLS =
  "id, event_id, ticket_type_id, ticket_type_name, event_title, event_date, event_time, venue, " +
  "buyer_name, buyer_display_name, buyer_contact, id_number, ticket_number, batch_id, receiver_name, " +
  "admit_count, party_composition, attendees, seat_number, payment_method, total_paid, currency, " +
  "payment_status, validated, validated_at, validated_by, is_admitted, admitted_at, purchased_at, sale_type";

// The column list above is a runtime string, so Supabase can't infer the row
// shape — cast select results to this before touching fields.
type GateTicket = {
  id: string;
  event_id: string;
  is_admitted: boolean;
  admitted_at: string;
  payment_status: string;
  [key: string]: unknown;
};

async function ownsEvent(admin: ReturnType<typeof createAdminClient>, eventId: string, userId: string, role: string) {
  if (role === "super_admin") return true;
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_id", userId)
    .maybeSingle();
  return !!event;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const admin = createAdminClient();
  if (!(await ownsEvent(admin, eventId, caller.userId, caller.role))) {
    return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 403 });
  }

  const { data, error } = await admin.from("tickets").select(GATE_TICKET_COLS).eq("event_id", eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, eventId, code, ticketId } = body;
  const admin = createAdminClient();

  if (action === "scan") {
    if (!eventId || !code) return NextResponse.json({ error: "eventId and code are required" }, { status: 400 });

    if (!(await ownsEvent(admin, eventId, caller.userId, caller.role))) {
      return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 403 });
    }

    // QR payloads arrive as a validation URL (current) or JSON (legacy); the
    // old .eq("qr_code", code) match compared against a stored data-URL image
    // string and could never find a ticket.
    const normalized = normalizeTicketCode(code);
    const filter = isUuid(normalized)
      ? `id.eq.${normalized},id_number.eq.${normalized}`
      : `id_number.eq.${normalized}`;

    const { data: tickets } = await admin
      .from("tickets")
      .select(GATE_TICKET_COLS)
      .eq("event_id", eventId)
      .or(filter)
      .order("purchased_at", { ascending: false })
      .limit(1);
    const ticket = tickets?.[0] as GateTicket | undefined;

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

    // The admit action takes only a ticketId — verify the ticket's event
    // belongs to this organizer before touching it (admin client bypasses RLS,
    // so the ownership check that RLS used to provide must be explicit).
    const { data: target } = await admin
      .from("tickets")
      .select("id, event_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ status: "admitted", ticket: null, message: "Ticket not found." });
    }
    if (!(await ownsEvent(admin, target.event_id, caller.userId, caller.role))) {
      return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 403 });
    }

    // .eq("is_admitted", false) + .eq("payment_status", "completed") make this
    // an atomic check-and-set — only a completed, not-yet-admitted ticket can
    // be flipped, closing both the double-scan race and the refunded-ticket
    // admission hole.
    const { data: ticket, error } = await admin
      .from("tickets")
      .update({ is_admitted: true, admitted_at: new Date().toISOString(), admitted_by: caller.userId, validated: true, validated_at: new Date().toISOString(), validated_by: caller.userId })
      .eq("id", ticketId)
      .eq("is_admitted", false)
      .eq("payment_status", "completed")
      .select(GATE_TICKET_COLS)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!ticket) {
      const { data: currentRow } = await admin.from("tickets").select(GATE_TICKET_COLS).eq("id", ticketId).maybeSingle();
      const current = currentRow as GateTicket | null;
      return NextResponse.json({
        status: "admitted",
        ticket: current,
        message: current ? `Already admitted at ${new Date(current.admitted_at).toLocaleTimeString()}` : "Ticket not found or payment not completed.",
      });
    }

    return NextResponse.json({ status: "admitted", ticket, message: "Successfully admitted!" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
