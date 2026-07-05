import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Contact list for the marketing composer — organizers and customers only,
// never admin/super_admin/staff accounts.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, email, phone, role")
    .in("role", ["customer", "organizer"])
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}
