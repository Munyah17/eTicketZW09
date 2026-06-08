import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "super_admin"];

export async function requireAdmin(): Promise<{ authed: true } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p || !ADMIN_ROLES.includes(p.role as string)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authed: true };
}
