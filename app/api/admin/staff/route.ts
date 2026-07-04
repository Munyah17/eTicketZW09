import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Manages platform Admin accounts — the Super Admin's own staff. Distinct from
// /api/admin/users, which manages organizers/staff/customers. Exclusively
// reachable by the Super Admin: an Admin is staff, not a peer, and must never
// be able to create, edit, or remove other Admin accounts.

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { email, password, name, phone } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "admin", phone: phone ?? "" },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  await supabase
    .from("profiles")
    .update({ name, role: "admin", phone: phone ?? "", verified: true })
    .eq("id", authData.user.id);

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "staff.create",
    resourceType: "profile",
    resourceId: authData.user.id,
    details: { email, name },
  });

  return NextResponse.json({ success: true, userId: authData.user.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { userId, name, phone, is_suspended, role } = body;

  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target || target.role !== "admin") {
    return NextResponse.json({ error: "Target is not an Admin account" }, { status: 404 });
  }

  // Role may only move within staff/organizer/customer from here — promoting
  // to super_admin is never exposed through any API.
  const ALLOWED_DEMOTIONS = new Set(["admin", "organizer", "staff", "customer"]);
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (is_suspended !== undefined) updates.is_suspended = Boolean(is_suspended);
  if (role !== undefined) {
    if (!ALLOWED_DEMOTIONS.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "staff.update",
    resourceType: "profile",
    resourceId: userId,
    details: updates,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role, email").eq("id", userId).single();
  if (!target || target.role !== "admin") {
    return NextResponse.json({ error: "Target is not an Admin account" }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "staff.remove",
    resourceType: "profile",
    resourceId: userId,
    details: { email: target.email },
  });

  return NextResponse.json({ success: true });
}
