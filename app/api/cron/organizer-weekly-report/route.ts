import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email/mailer";
import {
  buildWeeklyReportHtml,
  weeklyReportSubject,
  type OrganizerWeeklyReport,
  type CurrencyReport,
  type EventReportRow,
} from "@/lib/email/organizer-weekly-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Weekly organizer financial report. Runs on the Vercel cron schedule
// (vercel.json — Mondays 06:00 UTC / 08:00 CAT), and can be triggered
// manually by a signed-in super_admin.
//
//   GET /api/cron/organizer-weekly-report                  — send to all organizers
//   GET ...?dry_run=1                                      — compute reports, send nothing
//   GET ...?to=you@x.com                                   — redirect every send to one inbox (testing)
//   GET ...?organizer=org@x.com                            — only this organizer
//
// Vercel cron calls this with `Authorization: Bearer $CRON_SECRET`.

const DAY_MS = 24 * 60 * 60 * 1000;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  // Manual trigger path: a signed-in super_admin can run it from the portal.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "super_admin";
}

interface TicketRow {
  event_id: string;
  event_title: string;
  price: number;
  total_paid: number;
  platform_commission: number;
  currency: string;
  sale_type: "online" | "gate";
  events: { organizer_id: string } | null;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const toOverride = url.searchParams.get("to");
  const onlyOrganizer = url.searchParams.get("organizer")?.toLowerCase();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * DAY_MS);
  const since = periodStart.toISOString();
  const today = periodEnd.toISOString().slice(0, 10);

  const supabase = createAdminClient();

  const [organizersRes, eventsRes, ticketsRes, payoutsRes] = await Promise.all([
    supabase.from("organizers").select("id, user_id, name, email, pending_payout"),
    supabase.from("events").select("id, title, date, sold_tickets, total_tickets, organizer_id, status"),
    supabase
      .from("tickets")
      .select("event_id, event_title, price, total_paid, platform_commission, currency, sale_type, events!inner(organizer_id)")
      .eq("payment_status", "completed")
      .gte("purchased_at", since),
    supabase
      .from("payout_requests")
      .select("organizer_id, amount, currency, status, requested_at")
      .gte("requested_at", since),
  ]);

  const firstError = organizersRes.error || eventsRes.error || ticketsRes.error || payoutsRes.error;
  if (firstError) {
    return NextResponse.json({ error: `Data query failed: ${firstError.message}` }, { status: 500 });
  }

  const organizers = organizersRes.data ?? [];
  const events = eventsRes.data ?? [];
  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];
  const payouts = payoutsRes.data ?? [];

  // events.organizer_id -> profiles.id; organizers.user_id -> profiles.id.
  // Group this week's tickets by the owning profile, then map to the
  // organizer row for name/email/balance.
  const ticketsByProfile = new Map<string, TicketRow[]>();
  for (const t of tickets) {
    const pid = t.events?.organizer_id;
    if (!pid) continue;
    const list = ticketsByProfile.get(pid) ?? [];
    list.push(t);
    ticketsByProfile.set(pid, list);
  }

  const eventsByProfile = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsByProfile.get(e.organizer_id) ?? [];
    list.push(e);
    eventsByProfile.set(e.organizer_id, list);
  }

  const payoutsByOrganizer = new Map<string, typeof payouts>();
  for (const p of payouts) {
    const list = payoutsByOrganizer.get(p.organizer_id) ?? [];
    list.push(p);
    payoutsByOrganizer.set(p.organizer_id, list);
  }

  const results: { email: string; status: "sent" | "failed" | "skipped"; detail?: string }[] = [];

  for (const org of organizers) {
    if (!org.user_id || !org.email) continue;
    if (onlyOrganizer && org.email.toLowerCase() !== onlyOrganizer) continue;

    const orgEvents = eventsByProfile.get(org.user_id) ?? [];
    const weekTickets = ticketsByProfile.get(org.user_id) ?? [];

    // Nothing to report: no events at all and no sales this week.
    if (orgEvents.length === 0 && weekTickets.length === 0) {
      results.push({ email: org.email, status: "skipped", detail: "no events" });
      continue;
    }

    // Aggregate per currency — almost always a single currency, but the
    // schema allows mixed and summing across currencies would be wrong.
    const byCurrency = new Map<string, CurrencyReport & { eventMap: Map<string, EventReportRow> }>();
    for (const t of weekTickets) {
      const cur = t.currency || "USD";
      let bucket = byCurrency.get(cur);
      if (!bucket) {
        bucket = {
          currency: cur,
          ticketsSold: 0,
          grossSales: 0,
          onlineSales: 0,
          gateSales: 0,
          platformCommission: 0,
          netEarnings: 0,
          events: [],
          eventMap: new Map(),
        };
        byCurrency.set(cur, bucket);
      }
      bucket.ticketsSold += 1;
      bucket.grossSales += t.total_paid;
      bucket.platformCommission += t.platform_commission;
      bucket.netEarnings += t.price - t.platform_commission;
      if (t.sale_type === "gate") bucket.gateSales += t.total_paid;
      else bucket.onlineSales += t.total_paid;

      let ev = bucket.eventMap.get(t.event_id);
      if (!ev) {
        ev = { eventId: t.event_id, title: t.event_title, ticketsSold: 0, grossSales: 0, netEarnings: 0 };
        bucket.eventMap.set(t.event_id, ev);
      }
      ev.ticketsSold += 1;
      ev.grossSales += t.total_paid;
      ev.netEarnings += t.price - t.platform_commission;
    }
    for (const bucket of byCurrency.values()) {
      bucket.events = [...bucket.eventMap.values()].sort((a, b) => b.grossSales - a.grossSales);
    }

    const report: OrganizerWeeklyReport = {
      organizerName: org.name || "Organizer",
      organizerEmail: org.email,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      pendingPayout: org.pending_payout ?? 0,
      pendingPayoutCurrency: byCurrency.keys().next().value ?? "USD",
      currencies: [...byCurrency.values()].map(({ eventMap: _eventMap, ...c }) => c),
      upcomingEvents: orgEvents
        .filter((e) => e.status === "published" && e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ title: e.title, date: e.date, sold: e.sold_tickets, total: e.total_tickets })),
      recentPayouts: (payoutsByOrganizer.get(org.id) ?? [])
        .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
        .map((p) => ({ amount: p.amount, currency: p.currency, status: p.status, requestedAt: p.requested_at })),
    };

    if (dryRun) {
      results.push({ email: org.email, status: "skipped", detail: `dry run — ${report.currencies.reduce((n, c) => n + c.ticketsSold, 0)} tickets` });
      continue;
    }

    const send = await sendMail({
      to: toOverride ?? org.email,
      subject: weeklyReportSubject(report),
      html: buildWeeklyReportHtml(report),
    });

    results.push(
      send.sent
        ? { email: org.email, status: "sent", detail: `via ${send.via}${toOverride ? ` → ${toOverride}` : ""}` }
        : { email: org.email, status: "failed", detail: send.error }
    );
  }

  return NextResponse.json({
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    dryRun,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  });
}
