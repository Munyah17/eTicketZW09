import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Auth-level user actions that don't fit the profile PATCH — confirmation
// resends, password resets, email changes, manual confirmation. Same trust
// boundary as /api/admin/users: only organizer/staff/customer accounts, so
// an Admin can never touch a peer's or Super Admin's auth record here.
const MANAGEABLE_ROLES = new Set(["organizer", "staff", "customer"]);
const ACTIONS = ["resend-confirmation", "send-password-reset", "set-password", "confirm-email", "change-email"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: Action; email?: string; password?: string };
  const action = body.action;
  if (!id || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "userId and a valid action are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();

  if (!target || !MANAGEABLE_ROLES.has(target.role as string)) {
    return NextResponse.json({ error: "Target account is not manageable here" }, { status: 404 });
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const authHeaders = { apikey: serviceKey, "Content-Type": "application/json" };

  let detail: Record<string, unknown> = { email: target.email, action };

  switch (action) {
    case "resend-confirmation": {
      const r = await fetch(`${projectUrl}/auth/v1/resend`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ type: "signup", email: target.email }),
      });
      if (!r.ok) return NextResponse.json({ error: `Resend failed: ${await r.text()}` }, { status: 502 });
      break;
    }
    case "send-password-reset": {
      const r = await fetch(`${projectUrl}/auth/v1/recover`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ email: target.email }),
      });
      if (!r.ok) return NextResponse.json({ error: `Reset email failed: ${await r.text()}` }, { status: 502 });
      break;
    }
    case "set-password": {
      const password = body.password ?? "";
      if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      const { error } = await supabase.auth.admin.updateUserById(id, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      detail = { email: target.email, action, note: "password set by admin" };
      break;
    }
    case "confirm-email": {
      const { error } = await supabase.auth.admin.updateUserById(id, { email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const { error: pErr } = await supabase.from("profiles").update({ verified: true }).eq("id", id);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      break;
    }
    case "change-email": {
      const newEmail = (body.email ?? "").trim().toLowerCase();
      if (!newEmail.includes("@")) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
      const { error } = await supabase.auth.admin.updateUserById(id, { email: newEmail, email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const { error: pErr } = await supabase.from("profiles").update({ email: newEmail }).eq("id", id);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      detail = { oldEmail: target.email, newEmail, action };
      break;
    }
  }

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: `user.${action}`,
    resourceType: "profile",
    resourceId: id,
    details: detail,
  });

  return NextResponse.json({ success: true });
}
