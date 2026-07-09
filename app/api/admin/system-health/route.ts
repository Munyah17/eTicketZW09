import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { generateSystemDiagnosis } from "@/lib/groq";

// System Health control center — turns the platform's log tables (payments,
// tickets, payout_requests, audit_logs, support_tickets) into operational
// metrics: failure rates, error clusters, processing times, stuck
// transactions, rejections, and volume spikes.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

interface PaymentRow {
  reference: string;
  provider: string;
  status: string;
  error_message: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function collectHealthData() {
  const supabase = createAdminClient();
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY).toISOString();
  const d30 = new Date(now - 30 * DAY).toISOString();
  const h24 = now - DAY;

  const [
    { data: paymentRows },
    { data: payoutRows },
    { data: auditRows },
    { data: supportRows },
    { count: pendingReviewEvents },
    { data: unissuedTicketRows },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("reference, provider, status, error_message, amount, created_at, updated_at")
      .gte("created_at", d7)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("payout_requests")
      .select("status, decline_reason, requested_at, processed_at")
      .gte("created_at", d30)
      .limit(1000),
    supabase
      .from("audit_logs")
      .select("action, resource_type, actor_email, created_at")
      .gte("created_at", d7)
      .limit(5000),
    supabase
      .from("support_tickets")
      .select("status, priority, type, created_at, resolved_at")
      .gte("created_at", d30)
      .limit(1000),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    // Tickets generated in the last 7 days that were never pushed to any
    // channel. Column exists only after the delivery-tracking migration —
    // failure here is tolerated below.
    supabase
      .from("tickets")
      .select("id, event_title, buyer_email, purchased_at")
      .is("issued_at", null)
      .gte("created_at", d7)
      .limit(100),
  ]);

  const payments = (paymentRows ?? []) as PaymentRow[];
  const isSuccess = (s: string) => s === "paid" || s === "completed";
  const isFailed = (s: string) => s === "failed";
  const in24h = (iso: string) => new Date(iso).getTime() >= h24;

  // ── Payment outcome rates ──────────────────────────────────────────────
  const p7 = { total: payments.length, success: 0, failed: 0, pending: 0 };
  const p24 = { total: 0, success: 0, failed: 0, pending: 0 };
  const stuckPending: PaymentRow[] = [];
  const processingSecs: number[] = [];
  const providerMap = new Map<string, { total: number; failed: number; success: number }>();
  const errorMap = new Map<string, { count: number; lastSeen: string; provider: string }>();

  for (const p of payments) {
    const recent = in24h(p.created_at);
    if (recent) p24.total += 1;

    if (isSuccess(p.status)) {
      p7.success += 1;
      if (recent) p24.success += 1;
      const secs = (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 1000;
      if (secs >= 0 && secs < DAY / 1000) processingSecs.push(secs);
    } else if (isFailed(p.status)) {
      p7.failed += 1;
      if (recent) p24.failed += 1;
      if (p.error_message) {
        const key = p.error_message.slice(0, 140);
        const bucket = errorMap.get(key) ?? { count: 0, lastSeen: p.created_at, provider: p.provider };
        bucket.count += 1;
        if (p.created_at > bucket.lastSeen) bucket.lastSeen = p.created_at;
        errorMap.set(key, bucket);
      }
    } else {
      p7.pending += 1;
      if (recent) p24.pending += 1;
      if (now - new Date(p.created_at).getTime() > 30 * 60 * 1000) stuckPending.push(p);
    }

    const prov = providerMap.get(p.provider) ?? { total: 0, failed: 0, success: 0 };
    prov.total += 1;
    if (isFailed(p.status)) prov.failed += 1;
    if (isSuccess(p.status)) prov.success += 1;
    providerMap.set(p.provider, prov);
  }

  const decided7 = p7.success + p7.failed;
  const decided24 = p24.success + p24.failed;
  const failureRate7d = decided7 > 0 ? (p7.failed / decided7) * 100 : 0;
  const failureRate24h = decided24 > 0 ? (p24.failed / decided24) * 100 : 0;

  processingSecs.sort((a, b) => a - b);
  const avgProcessingSecs = processingSecs.length
    ? processingSecs.reduce((s, v) => s + v, 0) / processingSecs.length
    : 0;
  const p95ProcessingSecs = percentile(processingSecs, 95);

  // ── Hourly volume series (last 48h) + spike detection over 7d ──────────
  const hourlyCounts = new Map<number, { attempts: number; failed: number; success: number }>();
  for (const p of payments) {
    const bucket = Math.floor(new Date(p.created_at).getTime() / HOUR);
    const h = hourlyCounts.get(bucket) ?? { attempts: 0, failed: 0, success: 0 };
    h.attempts += 1;
    if (isFailed(p.status)) h.failed += 1;
    if (isSuccess(p.status)) h.success += 1;
    hourlyCounts.set(bucket, h);
  }
  const nowBucket = Math.floor(now / HOUR);
  const hourlySeries = [];
  for (let b = nowBucket - 47; b <= nowBucket; b++) {
    const h = hourlyCounts.get(b) ?? { attempts: 0, failed: 0, success: 0 };
    hourlySeries.push({
      hour: new Date(b * HOUR).toISOString().slice(11, 16),
      ...h,
    });
  }
  const allHourly = [];
  for (let b = nowBucket - 7 * 24 + 1; b <= nowBucket; b++) {
    allHourly.push(hourlyCounts.get(b)?.attempts ?? 0);
  }
  const hourlyMean = allHourly.reduce((s, v) => s + v, 0) / allHourly.length;
  const hourlyStd = Math.sqrt(allHourly.reduce((s, v) => s + (v - hourlyMean) ** 2, 0) / allHourly.length);
  const spikeThreshold = hourlyMean + 3 * hourlyStd;
  const volumeSpikes = hourlySeries.filter((h) => h.attempts > Math.max(spikeThreshold, 5)).slice(-24);

  const topErrors = [...errorMap.entries()]
    .map(([message, v]) => ({ message, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const providerBreakdown = [...providerMap.entries()].map(([provider, v]) => ({
    provider,
    ...v,
    failureRate: v.success + v.failed > 0 ? (v.failed / (v.success + v.failed)) * 100 : 0,
  }));

  // ── Payouts ────────────────────────────────────────────────────────────
  const payouts = payoutRows ?? [];
  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
  const declinedPayouts = payouts
    .filter((p) => p.status === "declined")
    .map((p) => ({ reason: p.decline_reason || "No reason recorded", at: p.processed_at || p.requested_at }));

  // ── Audit activity ─────────────────────────────────────────────────────
  const audit = auditRows ?? [];
  const audit24h = audit.filter((a) => in24h(a.created_at)).length;
  const auditDailyAvg = audit.length / 7;
  const actionCounts = new Map<string, number>();
  for (const a of audit) actionCounts.set(a.action, (actionCounts.get(a.action) ?? 0) + 1);
  const topActions = [...actionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Support load ───────────────────────────────────────────────────────
  const support = supportRows ?? [];
  const openSupport = support.filter((s) => s.status === "open" || s.status === "in_progress").length;
  const highPriorityOpen = support.filter(
    (s) => (s.status === "open" || s.status === "in_progress") && s.priority === "high"
  ).length;
  const resolved = support.filter((s) => s.resolved_at);
  const avgResolutionHours = resolved.length
    ? resolved.reduce((s, t) => s + (new Date(t.resolved_at as string).getTime() - new Date(t.created_at).getTime()), 0) /
      resolved.length /
      HOUR
    : 0;

  const unissuedTickets = unissuedTicketRows ?? [];

  // ── Alerts ─────────────────────────────────────────────────────────────
  const alerts: Alert[] = [];

  if (decided24 >= 5 && failureRate24h > Math.max(2 * failureRate7d, failureRate7d + 10) && failureRate24h > 20) {
    alerts.push({
      severity: "critical",
      title: "Payment failure rate spike",
      detail: `${failureRate24h.toFixed(0)}% of decided payments failed in the last 24h vs ${failureRate7d.toFixed(0)}% over 7 days (${p24.failed} failures).`,
    });
  } else if (decided7 >= 10 && failureRate7d > 25) {
    alerts.push({
      severity: "warning",
      title: "Elevated payment failure rate",
      detail: `${failureRate7d.toFixed(0)}% of decided payments failed over the last 7 days (${p7.failed} of ${decided7}).`,
    });
  }

  if (stuckPending.length >= 5) {
    alerts.push({
      severity: "critical",
      title: `${stuckPending.length} payments stuck in pending`,
      detail: "Pending for over 30 minutes — webhooks may not be arriving. Check gateway webhook config and reconcile via Payment Verification.",
    });
  } else if (stuckPending.length > 0) {
    alerts.push({
      severity: "warning",
      title: `${stuckPending.length} payment${stuckPending.length > 1 ? "s" : ""} stuck in pending`,
      detail: "Pending for over 30 minutes. May resolve on their own, or verify manually under Payment Verification.",
    });
  }

  if (unissuedTickets.length > 0) {
    alerts.push({
      severity: "critical",
      title: `${unissuedTickets.length} ticket${unissuedTickets.length > 1 ? "s" : ""} generated but not issued`,
      detail: "Ticket rows exist but no email/WhatsApp push succeeded — buyers paid and have received nothing. Check RESEND_API_KEY / WhatsApp API config and resend from All Tickets.",
    });
  }

  if (p95ProcessingSecs > 15 * 60 && processingSecs.length >= 5) {
    alerts.push({
      severity: "warning",
      title: "Slow payment confirmation",
      detail: `95th percentile time from initiation to confirmation is ${(p95ProcessingSecs / 60).toFixed(0)} minutes — webhooks may be delayed.`,
    });
  }

  if (highPriorityOpen > 0) {
    alerts.push({
      severity: "warning",
      title: `${highPriorityOpen} high-priority support ticket${highPriorityOpen > 1 ? "s" : ""} open`,
      detail: "Unresolved high-priority customer issues in Support & Ops.",
    });
  }

  if (audit24h > Math.max(2 * auditDailyAvg, 20)) {
    alerts.push({
      severity: "warning",
      title: "Unusual admin activity volume",
      detail: `${audit24h} audit-logged admin actions in 24h vs a ${auditDailyAvg.toFixed(0)}/day average — review the Audit Log.`,
    });
  }

  if (volumeSpikes.length > 0) {
    const peak = volumeSpikes.reduce((max, h) => (h.attempts > max.attempts ? h : max), volumeSpikes[0]);
    alerts.push({
      severity: "info",
      title: "Payment volume spike detected",
      detail: `${peak.attempts} payment attempts at ${peak.hour} UTC vs an hourly average of ${hourlyMean.toFixed(1)} — likely a popular event on sale.`,
    });
  }

  if ((pendingReviewEvents ?? 0) > 0) {
    alerts.push({
      severity: "info",
      title: `${pendingReviewEvents} event${(pendingReviewEvents ?? 0) > 1 ? "s" : ""} awaiting review`,
      detail: "Organizer events pending approval under Events & Markups.",
    });
  }

  const status = alerts.some((a) => a.severity === "critical")
    ? "critical"
    : alerts.some((a) => a.severity === "warning")
    ? "degraded"
    : "operational";

  return {
    generatedAt: new Date(now).toISOString(),
    status,
    alerts,
    payments: {
      last24h: p24,
      last7d: p7,
      failureRate24h,
      failureRate7d,
      avgProcessingSecs,
      p95ProcessingSecs,
      stuckPending: stuckPending.slice(0, 20).map((p) => ({
        reference: p.reference,
        provider: p.provider,
        amount: p.amount,
        created_at: p.created_at,
      })),
      topErrors,
      providerBreakdown,
      hourlySeries,
    },
    tickets: {
      unissued: unissuedTickets,
    },
    payouts: {
      pending: pendingPayouts,
      declined30d: declinedPayouts.slice(0, 10),
    },
    audit: {
      total7d: audit.length,
      last24h: audit24h,
      dailyAvg: auditDailyAvg,
      topActions,
    },
    support: {
      open: openSupport,
      highPriorityOpen,
      avgResolutionHours,
    },
    pendingReviewEvents: pendingReviewEvents ?? 0,
  };
}

type HealthData = Awaited<ReturnType<typeof collectHealthData>>;

function buildLogSummaryForAI(h: HealthData): string {
  return `
System status: ${h.status.toUpperCase()} (${h.alerts.length} active alerts)
Generated: ${h.generatedAt}

Active alerts:
${h.alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`).join("\n") || "None."}

Payments, last 24h: ${h.payments.last24h.total} attempts — ${h.payments.last24h.success} succeeded, ${h.payments.last24h.failed} failed, ${h.payments.last24h.pending} pending. Failure rate ${h.payments.failureRate24h.toFixed(1)}%.
Payments, last 7d: ${h.payments.last7d.total} attempts — ${h.payments.last7d.success} succeeded, ${h.payments.last7d.failed} failed, ${h.payments.last7d.pending} pending. Failure rate ${h.payments.failureRate7d.toFixed(1)}%.
Payment confirmation time (initiation → confirmed): avg ${(h.payments.avgProcessingSecs / 60).toFixed(1)} min, p95 ${(h.payments.p95ProcessingSecs / 60).toFixed(1)} min.
Payments stuck in pending >30min: ${h.payments.stuckPending.length}${h.payments.stuckPending.length ? ` (providers: ${[...new Set(h.payments.stuckPending.map((p) => p.provider))].join(", ")})` : ""}.

Gateway breakdown (7d):
${h.payments.providerBreakdown.map((p) => `${p.provider}: ${p.total} attempts, ${p.success} succeeded, ${p.failed} failed (${p.failureRate.toFixed(1)}% failure rate)`).join("\n") || "No payment attempts."}

Top payment error messages (7d):
${h.payments.topErrors.map((e) => `${e.count}× [${e.provider}] "${e.message}" (last seen ${e.lastSeen})`).join("\n") || "No recorded payment errors."}

Tickets generated but NOT issued (no email/WhatsApp delivery succeeded, 7d): ${h.tickets.unissued.length}

Payouts: ${h.payouts.pending} pending requests. Declined in last 30d: ${h.payouts.declined30d.length}${h.payouts.declined30d.length ? ` — reasons: ${h.payouts.declined30d.map((d) => `"${d.reason}"`).join("; ")}` : ""}.

Admin audit activity: ${h.audit.last24h} actions in 24h vs ${h.audit.dailyAvg.toFixed(1)}/day average over 7d.
Top admin actions (7d): ${h.audit.topActions.map((a) => `${a.action} (${a.count})`).join(", ") || "none"}.

Support: ${h.support.open} tickets open (${h.support.highPriorityOpen} high priority). Avg resolution time ${h.support.avgResolutionHours.toFixed(1)}h.
Events awaiting review: ${h.pendingReviewEvents}.
`.trim();
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const health = await collectHealthData();
    return NextResponse.json({ health });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to collect health data" },
      { status: 500 }
    );
  }
}

// POST runs the AI troubleshooter over a fresh snapshot of the same log data.
export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const health = await collectHealthData();
    const summary = buildLogSummaryForAI(health);
    const diagnosis = await generateSystemDiagnosis(summary);
    if (!diagnosis) {
      return NextResponse.json({
        diagnosis: null,
        aiError: "Add GROQ_API_KEY to your environment to enable the AI troubleshooter (free at console.groq.com).",
      });
    }
    return NextResponse.json({ diagnosis, aiError: null });
  } catch (e) {
    return NextResponse.json(
      { diagnosis: null, aiError: e instanceof Error ? e.message : "AI diagnosis failed" },
      { status: 500 }
    );
  }
}
