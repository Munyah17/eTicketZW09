import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Auto-removal of past events. Runs on the Vercel cron schedule (vercel.json)
// and can be triggered manually by a signed-in super_admin.
//
//   GET /api/cron/event-cleanup
//
// Behaviour is governed by platform_config:
//   event_auto_removal_enabled — master switch (default OFF = keep everything)
//   event_auto_removal_days    — events whose date is more than this many days
//                                in the past are removed from public listings
//
// "Removal" sets status='completed' rather than deleting the row, so sales
// history, tickets, orders and payouts are preserved — the event simply stops
// appearing in published listings. Manual removal stays available to admins
// from the Events list at any time.
//
// Vercel cron calls this with `Authorization: Bearer $CRON_SECRET`.

const DAY_MS = 24 * 60 * 60 * 1000;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "super_admin";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("platform_config")
    .select("event_auto_removal_enabled, event_auto_removal_days")
    .eq("id", 1)
    .maybeSingle();

  if (!config?.event_auto_removal_enabled) {
    return NextResponse.json({ removed: 0, reason: "auto-removal disabled" });
  }

  const days = Math.min(Math.max(Number(config.event_auto_removal_days) || 30, 1), 365);
  const cutoff = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

  // Only published events past the cutoff are touched — drafts, pending,
  // cancelled and already-completed events are left alone.
  const { data: stale, error } = await supabase
    .from("events")
    .select("id, title, date")
    .eq("status", "published")
    .lt("date", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!stale || stale.length === 0) {
    return NextResponse.json({ removed: 0, cutoff, checked: 0 });
  }

  const ids = stale.map((e) => e.id);
  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    removed: ids.length,
    cutoff,
    days,
    events: stale.map((e) => ({ id: e.id, title: e.title, date: e.date })),
  });
}
