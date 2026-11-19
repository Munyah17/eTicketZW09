import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, normalizeTicketCode } from "@/lib/validation";
import { looksLikeTicketNumber, normalizeTicketNumber } from "@/lib/ticket-number";

// Ticket admission control â€” restricted to staff/organizer/admin accounts.
// This searches across ALL tickets platform-wide (no event/organizer scope),
// unlike /api/organizer/gate which is scoped to one organizer's own events â€”
// intended for platform-employed gate staff working across venues.
const AUTHORIZED_ROLES = new Set(["admin", "super_admin", "organizer", "staff"]);

// Columns safe to return to gate staff — excludes buyer_email, qr_code,
// custom_field_responses, platform_commission and other payment internals
// that admission does not need. select("*") used to leak all of them.
const GATE_TICKET_COLS = "id, event_id, ticket_type_id, ticket_type_name, event_title, event_date, event_time, venue, buyer_name, buyer_display_name, buyer_contact, id_number, ticket_number, batch_id, receiver_name, admit_count, party_composition, attendees, seat_number, payment_method, total_paid, currency, payment_status, validated, validated_at, validated_by, is_admitted, admitted_at, purchased_at, sale_type";

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const { data: profile } = await supabase.from("profiles").select("role, is_suspended").eq("id", user.id).single();
  if (!profile || !AUTHORIZED_ROLES.has(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden â€” staff accounts only" }, { status: 403 }) } as const;
  }
  if (profile.is_suspended) {
    return { error: NextResponse.json({ error: "Account suspended" }, { status: 403 }) } as const;
  }

  return { userId: user.id } as const;
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { action, code, ticketId, batchId } = body;
  const admin = createAdminClient();

  if (action === "lookup") {
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

    // Scanned QR codes arrive as a validation URL (current) or JSON (legacy);
    // manual entry arrives as a raw uuid, national ID number, or the printed
    // ET-DDMMYY-XXXXX ticket number. Normalize all of them down to the
    // identifier before building the filter.
    const normalized = normalizeTicketCode(code);

    // id is a uuid column â€” only include it in the OR filter when the
    // entered code actually looks like one, otherwise PostgREST errors on
    // the malformed comparison instead of just finding no rows. id_number
    // is also searchable so staff can admit someone on a lost/forgotten
    // ticket using just their ID â€” .limit(1) covers the (rare) case where
    // two tickets share an ID number, picking the most recent purchase.
    // ticket_number is the human-facing code printed on the ticket.
    const filters = ["id_number.eq." + normalized];
    if (isUuid(normalized)) filters.push(`id.eq.${normalized}`);
    if (looksLikeTicketNumber(normalized)) filters.push(`ticket_number.eq.${normalizeTicketNumber(normalized)}`);
    const filter = filters.join(",");

    const { data: tickets } = await admin
      .from("tickets")
      .select(GATE_TICKET_COLS)
      .or(filter)
      .eq("payment_status", "completed")
      .order("purchased_at", { ascending: false })
      .limit(1);
    const ticket = tickets?.[0];

    if (!ticket) {
      return NextResponse.json({ status: "invalid", message: "Invalid ticket code. Please check and try again." });
    }
    if (ticket.validated) {
      return NextResponse.json({
        status: "used",
        ticket,
        message: `This ticket was already validated on ${new Date(ticket.validated_at).toLocaleString()}`,
      });
    }
    return NextResponse.json({ status: "valid", ticket, message: "Ticket is valid! Allow entry." });
  }

  // Batch barcode scan â€” every ticket minted under one payment shares a
  // batch_id, so one scan lists the whole purchase. Each ticket in the
  // response is still validated/admitted individually.
  if (action === "lookup_batch") {
    if (!batchId) return NextResponse.json({ error: "batchId is required" }, { status: 400 });

    const { data: tickets } = await admin
      .from("tickets")
      .select(GATE_TICKET_COLS)
      .eq("batch_id", batchId)
      .order("purchased_at", { ascending: true });

    if (!tickets?.length) {
      return NextResponse.json({ status: "invalid", message: "No tickets found for this batch." });
    }
    return NextResponse.json({ status: "batch", tickets, message: `${tickets.length} ticket(s) in this batch.` });
  }

  // Admit every remaining ticket in a batch at once â€” the family-arrives-
  // together fast path. Individual admission still uses mark_used.
  if (action === "mark_batch_used") {
    if (!batchId) return NextResponse.json({ error: "batchId is required" }, { status: 400 });

    const now = new Date().toISOString();
    const { data: tickets, error } = await admin
      .from("tickets")
      .update({
        validated: true,
        validated_at: now,
        validated_by: auth.userId,
        is_admitted: true,
        admitted_at: now,
        admitted_by: auth.userId,
      })
      .eq("batch_id", batchId)
      .eq("validated", false)
      .eq("payment_status", "completed")
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      status: "used",
      tickets,
      message: `${tickets?.length ?? 0} ticket(s) admitted.`,
    });
  }

  if (action === "mark_used") {
    if (!ticketId) return NextResponse.json({ error: "ticketId is required" }, { status: 400 });

    // Guard the write with .eq("validated", false) so two near-simultaneous
    // scans of the same ticket can't both succeed â€” only the first commits;
    // the second finds zero rows affected and is told the ticket is used.
    const { data: ticket, error } = await admin
      .from("tickets")
      .update({
        validated: true,
        validated_at: new Date().toISOString(),
        validated_by: auth.userId,
        is_admitted: true,
        admitted_at: new Date().toISOString(),
        admitted_by: auth.userId,
      })
      .eq("id", ticketId)
      .eq("validated", false)
      .eq("payment_status", "completed")
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!ticket) {
      const { data: current } = await admin.from("tickets").select(GATE_TICKET_COLS).eq("id", ticketId).single();
      return NextResponse.json({
        status: "used",
        ticket: current,
        message: current
          ? `This ticket was already validated on ${new Date(current.validated_at).toLocaleString()}`
          : "Ticket not found.",
      });
    }

    return NextResponse.json({ status: "used", ticket, message: "Ticket has been marked as validated." });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
