"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Sparkles, DollarSign, Ticket, CalendarDays, TrendingUp,
  RefreshCw, Bot, AlertCircle, Crown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatCompactNumber } from "@/lib/utils";

interface Stats {
  totalRevenue: number;
  totalTicketsSold: number;
  totalEvents: number;
  avgTicketPrice: number;
  topEvents: { title: string; organizer: string; category: string; city: string; soldTickets: number; totalTickets: number; revenue: number; sellThrough: number }[];
  categoryPerformance: { category: string; events: number; sold: number; revenue: number }[];
  cityPerformance: { city: string; events: number; sold: number; revenue: number }[];
  salesTrend: { week: string; revenue: number; tickets: number }[];
  organizerDemographics: { category: string; count: number }[];
  signupGrowth: { month: string; customers: number; organizers: number }[];
}

// Minimal Markdown renderer for the AI-generated report — handles the
// headers/bullets/bold that the model is instructed to produce, nothing more.
function AiNarrative({ text }: { text: string }) {
  const lines = text.split("\n");
  const renderInline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        : <Fragment key={i}>{part}</Fragment>
    );

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
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
        return <p key={i} className="text-muted-foreground">{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

export default function AiInsightsPage() {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-insights");
      const json = await res.json();
      if (res.ok) {
        setStats(json.stats);
        setAiNarrative(json.aiNarrative);
        setAiError(json.aiError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Crown className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="font-medium">Super Admin only</p>
        <p className="text-sm text-muted-foreground mt-1">AI Data Analytics is exclusive to the Super Admin account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Data Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Business insights computed from real platform data, narrated by a free open-source AI model.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading || !stats ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Revenue" value={`$${formatCompactNumber(stats.totalRevenue)}`} icon={DollarSign} iconClassName="bg-emerald-50 text-emerald-600" />
            <StatCard label="Tickets Sold" value={formatCompactNumber(stats.totalTicketsSold)} icon={Ticket} iconClassName="bg-blue-50 text-blue-600" />
            <StatCard label="Published Events" value={stats.totalEvents} icon={CalendarDays} iconClassName="bg-violet-50 text-violet-600" />
            <StatCard label="Avg. Ticket Price" value={`$${stats.avgTicketPrice.toFixed(2)}`} icon={TrendingUp} iconClassName="bg-amber-50 text-amber-600" />
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Business Insights</CardTitle>
                  <CardDescription className="text-xs">Llama 3.3 70B via Groq (free tier) — generated from the stats below</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {aiNarrative ? (
                <AiNarrative text={aiNarrative} />
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{aiError ?? "AI insights unavailable."}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.categoryPerformance} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompactNumber(v)}`} width={48} />
                    <Tooltip
                      formatter={(value: number, name: string) => [name === "revenue" ? `$${value.toFixed(2)}` : value, name === "revenue" ? "Revenue" : name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Revenue by City / Town</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.cityPerformance} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="city" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompactNumber(v)}`} width={48} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Weekly Sales Trend (Last 12 Weeks)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {stats.salesTrend.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No completed sales in the last 90 days.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={stats.salesTrend} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompactNumber(v)}`} width={48} />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Top Selling Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No sales data yet</TableCell>
                    </TableRow>
                  ) : (
                    stats.topEvents.map((e) => (
                      <TableRow key={e.title + e.organizer}>
                        <TableCell className="font-medium">{e.title}</TableCell>
                        <TableCell>{e.organizer}</TableCell>
                        <TableCell className="capitalize">{e.category}</TableCell>
                        <TableCell>{e.city}</TableCell>
                        <TableCell>{e.soldTickets}/{e.totalTickets} ({e.sellThrough.toFixed(0)}%)</TableCell>
                        <TableCell className="font-mono">${e.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {stats.organizerDemographics.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Organizer Demographics by Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.organizerDemographics} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} className="capitalize" />
                    <Tooltip
                      formatter={(value: number) => [value, "Organizers"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="var(--chart-3)" radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
