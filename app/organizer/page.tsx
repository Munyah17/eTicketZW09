"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  Ticket,
  TrendingUp,
  Plus,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrganizerEvents } from "@/lib/events-store";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/types";
import { Event } from "@/lib/types";

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);

  const loadEvents = useCallback(async () => {
    if (user) {
      const events = await getOrganizerEvents(user.id);
      setOrganizerEvents(events);
    }
  }, [user]);

  useEffect(() => {
    loadEvents();
    const refresh = () => { loadEvents(); };
    window.addEventListener("eticket:events-updated", refresh);
    return () => window.removeEventListener("eticket:events-updated", refresh);
  }, [loadEvents]);

  const totalTicketsSold = organizerEvents.reduce((sum, e) => sum + e.soldTickets, 0);
  const totalRevenue = organizerEvents.reduce((sum, e) => {
    return sum + e.ticketTypes.reduce((typeSum, t) => typeSum + t.sold * t.price, 0);
  }, 0);
  const platformFees = totalRevenue * (PLATFORM_FEE_PERCENTAGE / 100);
  const netRevenue = totalRevenue - platformFees;

  const stats = [
    {
      title: "Total Events",
      value: organizerEvents.length,
      icon: Calendar,
      sub: organizerEvents.length === 0 ? "Create your first event" : `${organizerEvents.filter(e => e.status === "published").length} published`,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      title: "Tickets Sold",
      value: totalTicketsSold.toLocaleString(),
      icon: Ticket,
      sub: totalTicketsSold === 0 ? "No tickets sold yet" : "Across all events",
      iconClassName: "bg-success/10 text-success",
    },
    {
      title: "Gross Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      sub: totalRevenue > 0 ? `Platform fee: $${platformFees.toFixed(2)}` : "No revenue yet",
      iconClassName: "bg-warning/10 text-warning",
    },
    {
      title: "Net Earnings",
      value: `$${netRevenue.toFixed(2)}`,
      icon: TrendingUp,
      sub: netRevenue > 0 ? "Available for payout" : "No earnings yet",
      iconClassName: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name || "Organizer"}!</h1>
          <p className="text-muted-foreground">
            {organizerEvents.length === 0
              ? "Get started by creating your first event."
              : "Here's what's happening with your events."}
          </p>
        </div>
        <Link href="/organizer/create">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Create New Event
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} label={stat.title} value={stat.value} sub={stat.sub} icon={stat.icon} iconClassName={stat.iconClassName} />
        ))}
      </div>

      {/* Events List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Events</CardTitle>
          <Link href="/organizer/events">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {organizerEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 font-medium">No events yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first event to start selling tickets.
              </p>
              <Link href="/organizer/create" className="mt-4 inline-block">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {organizerEvents.map((event) => {
                const soldPercentage =
                  event.totalTickets > 0
                    ? Math.round((event.soldTickets / event.totalTickets) * 100)
                    : 0;
                const eventRevenue = event.ticketTypes.reduce(
                  (sum, t) => sum + t.sold * t.price,
                  0
                );

                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-ZW", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          at {event.time}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Sold</p>
                        <p className="font-semibold">
                          {event.soldTickets}/{event.totalTickets}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-mono font-semibold">${eventRevenue.toFixed(2)}</p>
                      </div>
                      <Badge
                        variant={
                          soldPercentage >= 90
                            ? "destructive"
                            : soldPercentage >= 50
                            ? "default"
                            : "secondary"
                        }
                      >
                        {soldPercentage}% sold
                      </Badge>
                      <Link href={`/events/${event.id}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer transition-all hover:shadow-md">
          <Link href="/organizer/create">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-primary/10 p-3">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Create Event</h3>
                <p className="text-sm text-muted-foreground">List a new event</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md">
          <Link href="/organizer/advertising">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-warning/10 p-3">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold">Boost Event</h3>
                <p className="text-sm text-muted-foreground">Advertise on homepage</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md">
          <Link href="/organizer/payouts">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-success/10 p-3">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Request Payout</h3>
                <p className="text-sm text-muted-foreground">Withdraw earnings</p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
