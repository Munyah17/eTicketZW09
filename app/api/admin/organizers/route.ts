import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Organizer business-entity rows (organizers table) link to their user
// account via user_id -> profiles.id. Events are owned by the profile
// directly (events.organizer_id -> profiles.id), so event counts and
// revenue are computed by joining through that profile id, not organizers.id.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();

  const [{ data: organizers, error }, { data: events }, { data: payouts }] = await Promise.all([
    supabase.from("organizers").select("*").order("created_at", { ascending: false }),
    supabase.from("events").select("id, organizer_id, sold_tickets"),
    supabase.from("payout_requests").select("organizer_id, amount, status"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orgList = organizers ?? [];
  const eventRows = events ?? [];
  const payoutRows = payouts ?? [];

  // Revenue needs ticket_types pricing; fetch per-event totals in one query.
  const eventIds = eventRows.map((e) => e.id);
  const { data: ticketTypes } = eventIds.length
    ? await supabase.from("ticket_types").select("event_id, price, sold").in("event_id", eventIds)
    : { data: [] as { event_id: string; price: number; sold: number }[] };

  const revenueByEvent = new Map<string, number>();
  for (const tt of ticketTypes ?? []) {
    revenueByEvent.set(tt.event_id, (revenueByEvent.get(tt.event_id) ?? 0) + Number(tt.price) * Number(tt.sold));
  }

  const eventsByProfile = new Map<string, { count: number; revenue: number }>();
  for (const e of eventRows) {
    const entry = eventsByProfile.get(e.organizer_id) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += revenueByEvent.get(e.id) ?? 0;
    eventsByProfile.set(e.organizer_id, entry);
  }

  const pendingPayoutByOrg = new Map<string, number>();
  for (const p of payoutRows) {
    if (p.status !== "pending" && p.status !== "processing") continue;
    pendingPayoutByOrg.set(p.organizer_id, (pendingPayoutByOrg.get(p.organizer_id) ?? 0) + Number(p.amount));
  }

  const result = orgList.map((o) => {
    const stats = o.user_id ? eventsByProfile.get(o.user_id) : undefined;
    return {
      ...o,
      event_count: stats?.count ?? 0,
      computed_revenue: stats?.revenue ?? 0,
      computed_pending_payout: pendingPayoutByOrg.get(o.id) ?? 0,
    };
  });

  return NextResponse.json({ organizers: result });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { organizerId, verified } = body;
  if (!organizerId || verified === undefined) {
    return NextResponse.json({ error: "organizerId and verified are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("organizers").update({ verified: Boolean(verified) }).eq("id", organizerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "organizer.verify",
    resourceType: "organizer",
    resourceId: organizerId,
    details: { verified: Boolean(verified) },
  });

  return NextResponse.json({ success: true });
}
