import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Owner account — mirrors the hardcoded guard inside protect_super_admin():
// deletable by no one, and here also demotable by no one (a peer super admin
// demoting the owner is a lockout vector, not a management action).
const OWNER_EMAIL = "munyah777@gmail.com";
const DEMOTE_ROLES = new Set(["admin", "organizer", "staff", "customer"]);

// Super-admin account management is doubly gated: role=super_admin (as every
// /private path) AND a completed TOTP step-up (aal2). The proxy enforces
// aal2 on pages, but this API is reachable directly — so the check is
// repeated here rather than trusted to the portal shell.
async function requireSuperAdminAal2() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return { error: NextResponse.json({ error: "Two-factor verification required" }, { status: 403 }) } as const;
  }
  return auth;
}

// GET — every super_admin account with last sign-in and TOTP status.
export async function GET() {
  const auth = await requireSuperAdminAal2();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, name, username, verified, created_at")
    .eq("role", "super_admin")
    .order("created_at", { ascending: true });

  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 100 });
  const authById = new Map(
    (usersPage?.users ?? []).map((u) => [
      u.id,
      {
        last_sign_in_at: u.last_sign_in_at ?? null,
        totp: (u.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
      },
    ])
  );

  const accounts = (profiles ?? []).map((p) => ({
    ...p,
    isOwner: p.email === OWNER_EMAIL,
    last_sign_in_at: authById.get(p.id)?.last_sign_in_at ?? null,
    totp_enrolled: authById.get(p.id)?.totp ?? false,
  }));

  return NextResponse.json({ accounts });
}

// POST { email } — promote an existing account to super_admin. Goes through
// promote_super_admin(), the only permitted role escalation path in the DB.
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdminAal2();
  if ("error" in auth) return auth.error;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role, is_suspended")
    .ilike("email", normalized)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "No account with that email" }, { status: 404 });
  if (target.role === "super_admin") return NextResponse.json({ error: "Already a Super Admin" }, { status: 400 });
  if (target.is_suspended) return NextResponse.json({ error: "Account is suspended — unsuspend it first" }, { status: 400 });

  const { error } = await admin.rpc("promote_super_admin", { p_user_id: target.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "super_admin.promote",
    resourceType: "profile",
    resourceId: target.id,
    details: { email: target.email },
  });
  return NextResponse.json({ success: true });
}

// PATCH { userId, role } — demote a super_admin to a regular role. Owner and
// self-demotion are refused; the DB trigger independently guards the
// last-remaining super_admin.
export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdminAal2();
  if ("error" in auth) return auth.error;

  const { userId, role } = (await req.json().catch(() => ({}))) as { userId?: string; role?: string };
  if (!userId || !role || !DEMOTE_ROLES.has(role)) {
    return NextResponse.json({ error: "userId and a valid role are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.role !== "super_admin") {
    return NextResponse.json({ error: "Not a Super Admin account" }, { status: 404 });
  }
  if (target.email === OWNER_EMAIL) {
    return NextResponse.json({ error: "The owner Super Admin cannot be demoted" }, { status: 403 });
  }
  if (target.id === auth.user.id) {
    return NextResponse.json({ error: "You cannot demote your own account" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "super_admin.demote",
    resourceType: "profile",
    resourceId: target.id,
    details: { email: target.email, newRole: role },
  });
  return NextResponse.json({ success: true });
}

// DELETE { userId } — permanently remove a super_admin account via
// emergency_delete_user() (the only path that can delete a super_admin row).
// Owner and self are refused before the trigger is ever reached.
export async function DELETE(req: NextRequest) {
  const auth = await requireSuperAdminAal2();
  if ("error" in auth) return auth.error;

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.role !== "super_admin") {
    return NextResponse.json({ error: "Not a Super Admin account" }, { status: 404 });
  }
  if (target.email === OWNER_EMAIL) {
    return NextResponse.json({ error: "The owner Super Admin can never be deleted" }, { status: 403 });
  }

  const { error } = await admin.rpc("emergency_delete_user", { p_user_id: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "super_admin.delete",
    resourceType: "profile",
    resourceId: target.id,
    details: { email: target.email },
  });
  return NextResponse.json({ success: true });
}
