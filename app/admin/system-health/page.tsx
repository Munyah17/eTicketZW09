"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertCircle, AlertTriangle, Bot, CheckCircle2, Clock,
  DollarSign, HeadphonesIcon, Info, RefreshCw, ShieldAlert, Sparkles,
  TicketX, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

interface Health {
  generatedAt: string;
  status: "operational" | "degraded" | "critical";
  alerts: Alert[];
  payments: {
    last24h: { total: number; success: number; failed: number; pending: number };
    last7d: { total: number; success: number; failed: number; pending: number };
    failureRate24h: number;
    failureRate7d: number;
    avgProcessingSecs: number;
    p95ProcessingSecs: number;
    stuckPending: { reference: string; provider: string; amount: number; created_at: string }[];
    topErrors: { message: string; count: number; lastSeen: string; provider: string }[];
    providerBreakdown: { provider: string; total: number; failed: number; success: number; failureRate: number }[];
    hourlySeries: { hour: string; attempts: number; failed: number; success: number }[];
  };
  tickets: { unissued: { id: string; event_title: string; buyer_email: string; purchased_at: string }[] };
  payouts: { pending: number; declined30d: { reason: string; at: string }[] };
  audit: { total7d: number; last24h: number; dailyAvg: number; topActions: { action: string; count: number }[] };
  support: { open: number; highPriorityOpen: number; avgResolutionHours: number };
  pendingReviewEvents: number;
}

const STATUS_META = {
  operational: { label: "All Systems Operational", className: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  degraded: { label: "Degraded — Attention Needed", className: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  critical: { label: "Critical Issues Detected", className: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
} as const;

const SEVERITY_META = {
  critical: { icon: XCircle, className: "border-red-200 bg-red-50 text-red-800", iconClass: "text-red-600" },
  warning: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-800", iconClass: "text-amber-600" },
  info: { icon: Info, className: "border-blue-200 bg-blue-50 text-blue-800", iconClass: "text-blue-600" },
} as const;

// Minimal Markdown renderer for the AI diagnosis — headers, bullets,
// numbered steps, and bold, matching what the model is instructed to produce.
function DiagnosisText({ text }: { text: string }) {
  const renderInline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        : <Fragment key={i}>{part}</Fragment>
    );

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return <h3 key={i} className="text-base font-bold mt-4 first:mt-0">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith("# ")) {
          return <h2 key={i} className="text-lg font-bold mt-4 first:mt-0">{trimmed.slice(2)}</h2>;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <p className="text-muted-foreground">{renderInline(trimmed.slice(2))}</p>
            </div>
          );
        }
        const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-mono text-xs font-bold text-primary mt-0.5 shrink-0">{numbered[1]}.</span>
              <p className="text-muted-foreground">{renderInline(numbered[2])}</p>
            </div>
          );
        }
        return <p key={i} className="text-muted-foreground">{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function formatDuration(secs: number): string {
  if (secs <= 0) return "—";
  if (secs < 90) return `${secs.toFixed(0)}s`;
  return `${(secs / 60).toFixed(1)} min`;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-health");
      const json = await res.json();
      if (res.ok) setHealth(json.health);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runDiagnosis = async () => {
    setDiagnosing(true);
    setAiError(null);
    try {
      const res = await fetch("/api/admin/system-health", { method: "POST" });
      const json = await res.json();
      setDiagnosis(json.diagnosis);
      setAiError(json.aiError);
    } catch {
      setAiError("Failed to run AI diagnosis. Please try again.");
    } finally {
      setDiagnosing(false);
    }
  };

  const successRate24h = health && health.payments.last24h.success + health.payments.last24h.failed > 0
    ? 100 - health.payments.failureRate24h
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            System Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Control center built from live system logs — payments, ticket issuance, payouts, audit and support activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 text-xs font-semibold", STATUS_META[health.status].className)}>
              <span className={cn("h-2 w-2 rounded-full animate-pulse", STATUS_META[health.status].dot)} />
              {STATUS_META[health.status].label}
            </Badge>
          )}
          <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading || !health ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active alerts */}
          {health.alerts.length > 0 ? (
            <div className="space-y-2">
              {health.alerts.map((alert, i) => {
                const meta = SEVERITY_META[alert.severity];
                return (
                  <div key={i} className={cn("flex items-start gap-3 rounded-lg border p-3", meta.className)}>
                    <meta.icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.iconClass)} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="text-xs mt-0.5 opacity-90">{alert.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium">No anomalies detected in the current log window.</p>
            </div>
          )}

          {/* KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Payment Success (24h)"
              value={successRate24h === null ? "—" : `${successRate24h.toFixed(0)}%`}
              icon={CheckCircle2}
              iconClassName="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Failed Payments (24h)"
              value={health.payments.last24h.failed}
              icon={XCircle}
              iconClassName="bg-red-50 text-red-600"
            />
            <StatCard
              label="Stuck Pending"
              value={health.payments.stuckPending.length}
              icon={ShieldAlert}
              iconClassName="bg-amber-50 text-amber-600"
            />
            <StatCard
              label="Avg Confirm Time"
              value={formatDuration(health.payments.avgProcessingSecs)}
              icon={Clock}
              iconClassName="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Pending Payouts"
              value={health.payouts.pending}
              icon={DollarSign}
              iconClassName="bg-violet-50 text-violet-600"
            />
            <StatCard
              label="Open Support"
              value={health.support.open}
              icon={HeadphonesIcon}
              iconClassName="bg-cyan-50 text-cyan-600"
            />
          </div>

          {/* AI Troubleshooter */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Troubleshooter</CardTitle>
                    <CardDescription className="text-xs">
                      Feeds this log snapshot to the AI model to diagnose issues and recommend fixes
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={runDiagnosis} disabled={diagnosing} size="sm" className="gap-1.5">
                  <Sparkles className={cn("h-3.5 w-3.5", diagnosing && "animate-pulse")} />
                  {diagnosing ? "Analyzing logs..." : diagnosis ? "Re-run Diagnosis" : "Run AI Diagnosis"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {diagnosis ? (
                <DiagnosisText text={diagnosis} />
              ) : aiError ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{aiError}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run a diagnosis to have the AI read the current failure rates, gateway errors, stuck payments and
                  delivery problems, explain the likely root causes, and list concrete fixes.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment volume chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Payment Activity — Last 48 Hours</CardTitle>
              <CardDescription className="text-xs">
                Hourly payment attempts from the payments log. Spikes are flagged automatically against the 7-day baseline.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={health.payments.hourlySeries} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={5} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    formatter={(value: number, name: string) => [value, name === "success" ? "Succeeded" : name === "failed" ? "Failed" : "Pending/Other"]}
                  />
                  <Bar dataKey="success" stackId="a" fill="var(--chart-1)" name="success" />
                  <Bar dataKey="failed" stackId="a" fill="var(--destructive)" name="failed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Gateway breakdown */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Gateway Performance (7d)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gateway</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Succeeded</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Failure Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.payments.providerBreakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payment attempts in the last 7 days</TableCell>
                      </TableRow>
                    ) : (
                      health.payments.providerBreakdown.map((p) => (
                        <TableRow key={p.provider}>
                          <TableCell className="font-medium capitalize">{p.provider}</TableCell>
                          <TableCell className="text-right font-mono">{p.total}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">{p.success}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{p.failed}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={cn(
                              "font-mono",
                              p.failureRate >= 25 ? "border-red-200 bg-red-50 text-red-700"
                                : p.failureRate >= 10 ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}>
                              {p.failureRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top errors */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Top Payment Errors (7d)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Error</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.payments.topErrors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">No recorded payment errors 🎉</TableCell>
                      </TableRow>
                    ) : (
                      health.payments.topErrors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <p className="text-xs font-mono break-all">{e.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{e.provider} · last seen {new Date(e.lastSeen).toLocaleString("en-ZW")}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{e.count}×</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Unissued tickets */}
          {health.tickets.unissued.length > 0 && (
            <Card className="border-red-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <TicketX className="h-4 w-4" />
                  Tickets Generated But Not Issued
                </CardTitle>
                <CardDescription className="text-xs">
                  These buyers paid, the ticket exists, but neither the email nor the WhatsApp push succeeded.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Purchased</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.tickets.unissued.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}…</TableCell>
                        <TableCell className="font-medium">{t.event_title}</TableCell>
                        <TableCell>{t.buyer_email || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(t.purchased_at).toLocaleString("en-ZW")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Stuck payments */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Stuck Pending Payments (&gt;30 min)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Initiated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.payments.stuckPending.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No stuck payments</TableCell>
                      </TableRow>
                    ) : (
                      health.payments.stuckPending.map((p) => (
                        <TableRow key={p.reference}>
                          <TableCell className="font-mono text-xs">{p.reference.slice(0, 8)}…</TableCell>
                          <TableCell className="capitalize">{p.provider}</TableCell>
                          <TableCell className="text-right font-mono">${Number(p.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("en-ZW")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Admin activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Admin Activity (Audit Log, 7d)</CardTitle>
                <CardDescription className="text-xs">
                  {health.audit.last24h} actions in the last 24h · {health.audit.dailyAvg.toFixed(1)}/day average
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.audit.topActions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">No audit activity in the last 7 days</TableCell>
                      </TableRow>
                    ) : (
                      health.audit.topActions.map((a) => (
                        <TableRow key={a.action}>
                          <TableCell className="font-mono text-xs">{a.action}</TableCell>
                          <TableCell className="text-right font-mono">{a.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Payout rejections */}
          {health.payouts.declined30d.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Payout Rejections (30d)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {health.payouts.declined30d.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{d.reason}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(d.at).toLocaleString("en-ZW")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground text-right">
            Snapshot generated {new Date(health.generatedAt).toLocaleString("en-ZW")}
          </p>
        </>
      )}
    </div>
  );
}
