import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Manages regular platform accounts — organizers, staff, customers. Reachable
// by both Admin and Super Admin. Never touches admin/super_admin accounts —
// that's exclusively /api/admin/staff (Super Admin only), so an Admin can
// never see, edit, or delete another Admin or the Super Admin through here.
const MANAGEABLE_ROLES = new Set(["organizer", "staff", "customer"]);

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", Array.from(MANAGEABLE_ROLES))
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { email, password, name, role, phone } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name are required" }, { status: 400 });
  }
  if (role && !MANAGEABLE_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: role ?? "customer", phone: phone ?? "" },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  // The handle_new_user trigger already created the profile row from
  // user_metadata (role included) — this update only needs to force
  // verified:true so an admin-created account skips the self-signup
  // email-confirmation gate. Previously unchecked: a failed update here
  // left the account unverified with the route still reporting success.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name, role: role ?? "customer", phone: phone ?? "", verified: true })
    .eq("id", authData.user.id);
  if (profileError) {
    return NextResponse.json(
      { error: `Account created but profile setup failed: ${profileError.message}. The account may show as unverified.` },
      { status: 500 }
    );
  }

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "user.create",
    resourceType: "profile",
    resourceId: authData.user.id,
    details: { email, name, role: role ?? "customer" },
  });

  return NextResponse.json({ success: true, userId: authData.user.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { userId, role, is_suspended } = body;

  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target || !MANAGEABLE_ROLES.has(target.role as string)) {
    return NextResponse.json({ error: "Target account is not manageable here" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) {
    if (!MANAGEABLE_ROLES.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
  }
  if (is_suspended !== undefined) updates.is_suspended = Boolean(is_suspended);

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: is_suspended !== undefined ? (is_suspended ? "user.suspend" : "user.activate") : "user.role_change",
    resourceType: "profile",
    resourceId: userId,
    details: updates,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { userId } = body;

  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target || !MANAGEABLE_ROLES.has(target.role as string)) {
    return NextResponse.json({ error: "Target account is not manageable here" }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "user.delete",
    resourceType: "profile",
    resourceId: userId,
  });

  return NextResponse.json({ success: true });
}
