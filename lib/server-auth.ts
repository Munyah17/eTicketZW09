import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
