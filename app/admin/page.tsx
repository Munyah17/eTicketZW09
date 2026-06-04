import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Ticket,
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Building2,
  CreditCard,
} from "lucide-react";
import { mockEvents, mockTickets, mockOrganizers, mockPayoutRequests } from "@/lib/mock-data";

export default function AdminDashboard() {
  const totalRevenue = mockTickets.reduce((sum, t) => sum + t.totalPaid, 0);
  const platformFees = totalRevenue * 0.1;
  const pendingPayouts = mockPayoutRequests.filter(p => p.status === "pending").length;
  const pendingAmount = mockPayoutRequests.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const publishedEvents = mockEvents.filter(e => e.status === "published").length;
  const verifiedOrgs = mockOrganizers.filter(o => o.verified).length;

  const kpis = [
    {
      title: "Gross Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      sub: `$${platformFees.toLocaleString()} platform fees`,
      icon: DollarSign,
      accent: "bg-emerald-500",
      light: "bg-emerald-50 text-emerald-700",
      trend: "+15%",
      trendUp: true,
    },
    {
      title: "Tickets Sold",
      value: mockTickets.length.toLocaleString(),
      sub: `Across ${publishedEvents} live events`,
      icon: Ticket,
      accent: "bg-blue-500",
      light: "bg-blue-50 text-blue-700",
      trend: "+8%",
      trendUp: true,
    },
    {
      title: "Active Events",
      value: publishedEvents,
      sub: `${mockEvents.length} total on platform`,
      icon: Calendar,
      accent: "bg-violet-500",
      light: "bg-violet-50 text-violet-700",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Organizers",
      value: mockOrganizers.length,
      sub: `${verifiedOrgs} verified`,
      icon: Building2,
      accent: "bg-orange-500",
      light: "bg-orange-50 text-orange-700",
      trend: "+2 this month",
      trendUp: true,
    },
    {
      title: "Pending Payouts",
      value: pendingPayouts,
      sub: `$${pendingAmount.toLocaleString()} outstanding`,
      icon: CreditCard,
      accent: pendingPayouts > 0 ? "bg-amber-500" : "bg-slate-400",
      light: pendingPayouts > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600",
      trend: pendingPayouts > 0 ? "Needs action" : "All clear",
      trendUp: pendingPayouts === 0,
    },
    {
      title: "Platform Growth",
      value: "+15%",
      sub: "Revenue vs last month",
      icon: TrendingUp,
      accent: "bg-sky-500",
      light: "bg-sky-50 text-sky-700",
      trend: "On track",
      trendUp: true,
    },
  ];

  const recentEvents = mockEvents.slice(0, 6);
  const actionPayouts = mockPayoutRequests.filter(p => p.status === "pending" || p.status === "processing").slice(0, 5);

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-widest">Live</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">
            Real-time metrics and management controls for E-TicketsZW
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/payouts">
            {pendingPayouts > 0 && (
              <Button variant="destructive" size="sm" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                {pendingPayouts} Payout{pendingPayouts > 1 ? "s" : ""} Pending
              </Button>
            )}
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden border-0 shadow-sm bg-card">
            <div className={`absolute top-0 left-0 w-1 h-full ${kpi.accent}`} />
            <CardContent className="p-5 pl-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{kpi.title}</p>
                  <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{kpi.sub}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.light} ml-3`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${kpi.trendUp ? "text-emerald-600" : "text-amber-600"}`}>
                  {kpi.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Recent Events - wider */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base">Recent Events</CardTitle>
            </div>
            <Link href="/admin/events">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentEvents.map((event, i) => {
                const pct = Math.round((event.soldTickets / event.totalTickets) * 100);
                return (
                  <div key={event.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.organizerName} · {new Date(event.date).toLocaleDateString("en-ZW", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-semibold">{pct}%</p>
                        <p className="text-xs text-muted-foreground">sold</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        event.status === "published" ? "bg-emerald-100 text-emerald-700" :
                        event.status === "draft" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {event.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payout Actions - narrower */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-base">Payout Queue</CardTitle>
            </div>
            <Link href="/admin/payouts">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {actionPayouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                <p className="font-medium text-sm">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending payout requests</p>
              </div>
            ) : (
              <div className="divide-y">
                {actionPayouts.map((payout) => (
                  <div key={payout.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      {payout.organizerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{payout.organizerName}</p>
                      <p className="text-xs text-muted-foreground">{payout.paymentMethod}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">${payout.amount}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        payout.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {payout.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organiser summary row */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
              <Users className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="text-base">Top Organizers</CardTitle>
          </div>
          <Link href="/admin/organizers">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {mockOrganizers.slice(0, 4).map((org) => {
              const orgEvents = mockEvents.filter(e => e.organizerId === org.id);
              return (
                <div key={org.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {org.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{orgEvents.length} events · {org.email}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold">${org.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">revenue</p>
                    </div>
                    {org.verified ? (
                      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-0 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 text-xs">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
