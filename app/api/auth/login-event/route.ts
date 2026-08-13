import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/server-audit-log";

// Records admin/super_admin sign-in and sign-out events to the audit trail.
// Identity is re-verified server-side from the session cookie — the client
// only tells us which of the two events just happened, never who it was.
// Customer/organizer logins are out of scope (AuditAction only defines
// admin.login/admin.logout).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "admin.login" && action !== "admin.logout") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ success: true });
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;

  await logAudit({
    actorId: user.id,
    actorEmail: user.email ?? "",
    action,
    resourceType: "session",
    ipAddress,
  });

  return NextResponse.json({ success: true });
}
