"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Ticket, DollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";

interface OrgEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  city: string;
  total_tickets: number;
  sold_tickets: number;
  ticket_types: { price: number; sold: number }[];
}

interface OrgTicket {
  event_id: string;
  total_paid: number;
  payment_method: string;
}

export default function OrganizerAnalyticsPage() {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [tickets, setTickets] = useState<OrgTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organizer/sales")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTickets(data.tickets ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = tickets.reduce((sum, t) => sum + Number(t.total_paid), 0);
  const totalTickets = events.reduce((sum, e) => sum + e.total_tickets, 0);
  const soldTickets = events.reduce((sum, e) => sum + e.sold_tickets, 0);
  const avgTicketPrice = soldTickets > 0 ? totalRevenue / soldTickets : 0;
  const sellThroughRate = totalTickets > 0 ? Math.round((soldTickets / totalTickets) * 100) : 0;

  const stats = [
    { title: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign },
    { title: "Tickets Sold", value: soldTickets.toLocaleString(), icon: Ticket },
    { title: "Avg. Ticket Price", value: `$${avgTicketPrice.toFixed(2)}`, icon: BarChart3 },
    { title: "Sell-Through Rate", value: `${sellThroughRate}%`, icon: TrendingUp },
  ];

  const topEvents = [...events].sort((a, b) => b.sold_tickets - a.sold_tickets).slice(0, 5);
  const categories = [...new Set(events.map((e) => e.category))];
  const paymentMethods = [...new Set(tickets.map((t) => t.payment_method).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Performance insights for your events
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Events</CardTitle>
          <CardDescription>Events ranked by ticket sales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
          )}
          {topEvents.map((event, index) => {
            const soldPercentage = event.total_tickets > 0 ? Math.round((event.sold_tickets / event.total_tickets) * 100) : 0;
            const revenue = event.ticket_types.reduce((sum, tt) => sum + Number(tt.price) * Number(tt.sold), 0);
            return (
              <div key={event.id} className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.date).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "numeric" })} · {event.city}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{event.sold_tickets} tickets · {soldPercentage}%</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.length === 0 && <p className="text-sm text-muted-foreground">No events yet</p>}
            {categories.map((cat) => {
              const catEvents = events.filter((e) => e.category === cat);
              const catSold = catEvents.reduce((sum, e) => sum + e.sold_tickets, 0);
              const catTotal = catEvents.reduce((sum, e) => sum + e.total_tickets, 0);
              const percentage = catTotal > 0 ? Math.round((catSold / catTotal) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{cat}</span>
                    <span className="text-muted-foreground">{catSold}/{catTotal} ({percentage}%)</span>
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
            {paymentMethods.length === 0 && <p className="text-sm text-muted-foreground">No sales yet</p>}
            {paymentMethods.map((method) => {
              const methodSales = tickets.filter((t) => t.payment_method === method);
              const methodRevenue = methodSales.reduce((sum, s) => sum + Number(s.total_paid), 0);
              const percentage = totalRevenue > 0 ? Math.round((methodRevenue / totalRevenue) * 100) : 0;
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
