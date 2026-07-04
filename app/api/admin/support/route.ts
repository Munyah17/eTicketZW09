import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { ticketId, status } = body;
  if (!ticketId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "ticketId and a valid status are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = auth.user.id;
  }

  const { error } = await supabase.from("support_tickets").update(updates).eq("id", ticketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "support.status_change",
    resourceType: "support_ticket",
    resourceId: ticketId,
    details: { status },
  });

  return NextResponse.json({ success: true });
}
