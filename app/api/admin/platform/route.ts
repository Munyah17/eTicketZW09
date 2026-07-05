import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

const ALLOWED_FIELDS = new Set([
  "service_fee_percent",
  "new_registrations",
  "new_organizer_signups",
  "maintenance_mode",
  "online_payments",
  "stripe_enabled",
  "paynow_enabled",
  "announcement_active",
  "announcement_message",
  "announcement_type",
  "announcement_link",
]);

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  if ("service_fee_percent" in updates) {
    const fee = Number(updates.service_fee_percent);
    updates.service_fee_percent = isNaN(fee) ? 10 : Math.min(Math.max(fee, 0), 50);
  }

  const supabase = createAdminClient();
  updates.updated_by = auth.user.id;

  const { data, error } = await supabase.from("platform_config").update(updates).eq("id", 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "platform.fee_change",
    resourceType: "platform_config",
    resourceId: "1",
    details: updates,
  });

  return NextResponse.json({ config: data });
}
