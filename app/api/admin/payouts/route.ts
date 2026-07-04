import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Payouts are requested through the system, but validated and paid out
// manually (bank/mobile money transfer happens outside this app) — this
// endpoint only records the outcome after you've actually sent (or declined)
// the money, it never calls a payment gateway.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payouts: data ?? [] });
}

const VALID_STATUSES = new Set(["processing", "approved", "declined"]);

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { payoutId, status, declineReason } = body;

  if (!payoutId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "payoutId and a valid status are required" }, { status: 400 });
  }
  if (status === "declined" && !declineReason?.trim()) {
    return NextResponse.json({ error: "A decline reason is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "approved" || status === "declined") {
    updates.processed_at = new Date().toISOString();
    updates.processed_by = auth.user.id;
  }
  if (status === "declined") updates.decline_reason = declineReason;

  const { error } = await supabase.from("payout_requests").update(updates).eq("id", payoutId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: status === "approved" ? "payout.approve" : status === "declined" ? "payout.decline" : "payout.manual",
    resourceType: "payout_request",
    resourceId: payoutId,
    details: { status, declineReason },
  });

  return NextResponse.json({ success: true });
}
