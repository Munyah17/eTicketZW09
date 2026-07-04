import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "super_admin"];

type AuthResult = { authed: true; user: { id: string; email: string } } | { error: NextResponse };

export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p || !ADMIN_ROLES.includes(p.role as string)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authed: true, user: { id: user.id, email: user.email ?? "" } };
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
  return { authed: true, user: { id: user.id, email: user.email ?? "" } };
}
