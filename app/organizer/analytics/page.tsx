"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Ticket, DollarSign, Users, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { mockEvents, mockTickets } from "@/lib/mock-data";

export default function OrganizerAnalyticsPage() {
  const organizerEvents = mockEvents.slice(0, 3);
  const eventIds = organizerEvents.map((e) => e.id);
  const sales = mockTickets.filter((t) => eventIds.includes(t.eventId));

  const totalRevenue = sales.reduce((sum, t) => sum + t.totalPaid, 0);
  const totalTickets = organizerEvents.reduce((sum, e) => sum + e.totalTickets, 0);
  const soldTickets = organizerEvents.reduce((sum, e) => sum + e.soldTickets, 0);
  const avgTicketPrice =
    organizerEvents.length > 0
      ? organizerEvents.reduce(
          (sum, e) =>
            sum + e.ticketTypes.reduce((s, t) => s + t.price * t.sold, 0) / Math.max(e.soldTickets, 1),
          0
        ) / organizerEvents.length
      : 0;

  const stats = [
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      change: "+12%",
      trend: "up" as const,
      icon: DollarSign,
    },
    {
      title: "Tickets Sold",
      value: soldTickets.toLocaleString(),
      change: "+8%",
      trend: "up" as const,
      icon: Ticket,
    },
    {
      title: "Avg. Ticket Price",
      value: `$${avgTicketPrice.toFixed(2)}`,
      change: "-2%",
      trend: "down" as const,
      icon: BarChart3,
    },
    {
      title: "Sell-Through Rate",
      value: `${Math.round((soldTickets / totalTickets) * 100)}%`,
      change: "+5%",
      trend: "up" as const,
      icon: TrendingUp,
    },
  ];

  const topEvents = [...organizerEvents]
    .sort((a, b) => b.soldTickets - a.soldTickets)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Performance insights for your events
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <span
                      className={
                        stat.trend === "up" ? "text-success" : "text-destructive"
                      }
                    >
                      {stat.change}
                    </span>
                    <span className="text-muted-foreground">vs last month</span>
                  </div>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Events */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Events</CardTitle>
          <CardDescription>Events ranked by ticket sales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topEvents.map((event, index) => {
            const soldPercentage = Math.round(
              (event.soldTickets / event.totalTickets) * 100
            );
            const revenue = event.ticketTypes.reduce(
              (sum, t) => sum + t.sold * t.price,
              0
            );
            return (
              <div
                key={event.id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.date).toLocaleDateString("en-ZW", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {event.city}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.soldTickets} tickets · {soldPercentage}%
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Sales by Ticket Type */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["comedy", "music", "sports", "marathon"].map((cat) => {
              const catEvents = organizerEvents.filter((e) => e.category === cat);
              const catSold = catEvents.reduce((sum, e) => sum + e.soldTickets, 0);
              const catTotal = catEvents.reduce((sum, e) => sum + e.totalTickets, 0);
              const percentage = catTotal > 0 ? Math.round((catSold / catTotal) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{cat}</span>
                    <span className="text-muted-foreground">
                      {catSold}/{catTotal} ({percentage}%)
                    </span>
                  </div>
                  <ProgressBar value={percentage} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["ecocash", "visa", "innbucks", "cash"].map((method) => {
              const methodSales = sales.filter((s) => s.paymentMethod === method);
              const methodRevenue = methodSales.reduce((sum, s) => sum + s.totalPaid, 0);
              const totalSalesRevenue = sales.reduce((sum, s) => sum + s.totalPaid, 0);
              const percentage = totalSalesRevenue > 0 ? Math.round((methodRevenue / totalSalesRevenue) * 100) : 0;
              return (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{method}</span>
                    <span className="text-muted-foreground">
                      {methodSales.length} sales · ${methodRevenue.toFixed(0)} ({percentage}%)
                    </span>
                  </div>
                  <ProgressBar value={percentage} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
