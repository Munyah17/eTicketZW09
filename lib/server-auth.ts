import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ROLES = ["admin", "super_admin"];

type AuthResult = { authed: true; user: { id: string; email: string; role: string } } | { error: NextResponse };

export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p || !ADMIN_ROLES.includes(p.role as string)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authed: true, user: { id: user.id, email: user.email ?? "", role: p.role as string } };
}

// Stricter than requireAdmin — for actions that must never be reachable by a
// regular Admin (staff) account: managing Admin accounts themselves, platform
// config, security settings. Admin is staff working for Super Admin, not a peer.
export async function requireSuperAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p || p.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden — Super Admin only" }, { status: 403 }) };
  }
  return { authed: true, user: { id: user.id, email: user.email ?? "", role: p.role } };
}

// For organizer endpoints that should also be accessible by super admins for
// technical support. Returns the user with their role so the caller can check
// if they're a super admin and bypass ownership checks if needed.
export async function requireOrganizerOrSuperAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const role = p.role as string;
  // Allow both organizers and super admins
  if (role !== "organizer" && role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authed: true, user: { id: user.id, email: user.email ?? "", role } };
}

// Ticket PNG/wristband downloads. The rendered files embed the QR admission
// credential plus buyer PII, so the ticket id alone is not enough — allow
// (a) whoever knows the payment reference (guest checkout flow: the
// confirmation page links include it), or (b) a session belonging to the
// buyer, the event's organizer, or staff/admin.
export async function canAccessTicket(
  ticket: {
    payment_reference?: string | null;
    buyer_user_id?: string | null;
    buyer_email?: string | null;
    event_id?: string | null;
  },
  refParam: string | null
): Promise<boolean> {
  if (refParam && ticket.payment_reference && refParam === ticket.payment_reference) return true;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (ticket.buyer_user_id && ticket.buyer_user_id === user.id) return true;
  if (ticket.buyer_email && user.email && ticket.buyer_email.toLowerCase() === user.email.toLowerCase()) return true;

  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = p?.role as string | undefined;
  if (role === "admin" || role === "super_admin" || role === "staff") return true;

  if (role === "organizer" && ticket.event_id) {
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from("events")
      .select("organizer_id, organizers!inner(user_id)")
      .eq("id", ticket.event_id)
      .maybeSingle();
    const owner = (ev?.organizers as unknown as { user_id: string } | undefined)?.user_id;
    if (owner === user.id) return true;
  }
  return false;
}
