import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation";

// Ticket admission control — restricted to staff/organizer/admin accounts.
// This searches across ALL tickets platform-wide (no event/organizer scope),
// unlike /api/organizer/gate which is scoped to one organizer's own events —
// intended for platform-employed gate staff working across venues.
const AUTHORIZED_ROLES = new Set(["admin", "super_admin", "organizer", "staff"]);

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !AUTHORIZED_ROLES.has(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden — staff accounts only" }, { status: 403 }) } as const;
  }
  return { userId: user.id } as const;
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { action, code, ticketId } = body;
  const admin = createAdminClient();

  if (action === "lookup") {
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

    // id is a uuid column — only include it in the OR filter when the
    // entered code actually looks like one, otherwise PostgREST errors on
    // the malformed comparison instead of just finding no rows.
    const filter = isUuid(code) ? `id.eq.${code},qr_code.eq.${code}` : `qr_code.eq.${code}`;

    const { data: ticket } = await admin
      .from("tickets")
      .select("*")
      .or(filter)
      .maybeSingle();

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

  if (action === "mark_used") {
    if (!ticketId) return NextResponse.json({ error: "ticketId is required" }, { status: 400 });

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
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "used", ticket, message: "Ticket has been marked as validated." });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
