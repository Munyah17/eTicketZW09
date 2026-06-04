import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  Ticket,
  TrendingUp,
  Users,
  Plus,
  ArrowRight,
  Eye,
} from "lucide-react";
import { mockEvents, mockTickets } from "@/lib/mock-data";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/types";

export default function OrganizerDashboard() {
  // Calculate stats from mock data
  const organizerEvents = mockEvents.slice(0, 3); // Simulate organizer's events
  const totalTicketsSold = organizerEvents.reduce((sum, e) => sum + e.soldTickets, 0);
  const totalRevenue = organizerEvents.reduce((sum, e) => {
    const eventRevenue = e.ticketTypes.reduce((typeSum, t) => {
      return typeSum + t.sold * t.price;
    }, 0);
    return sum + eventRevenue;
  }, 0);
  const platformFees = totalRevenue * (PLATFORM_FEE_PERCENTAGE / 100);
  const netRevenue = totalRevenue - platformFees;

  const stats = [
    {
      title: "Total Events",
      value: organizerEvents.length,
      icon: Calendar,
      change: "+2 this month",
      color: "text-primary",
    },
    {
      title: "Tickets Sold",
      value: totalTicketsSold.toLocaleString(),
      icon: Ticket,
      change: "+15% vs last month",
      color: "text-success",
    },
    {
      title: "Gross Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      change: `Platform fee: $${platformFees.toFixed(2)}`,
      color: "text-warning",
    },
    {
      title: "Net Earnings",
      value: `$${netRevenue.toLocaleString()}`,
      icon: TrendingUp,
      change: "Available for payout",
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, Organizer!</h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your events
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className={`rounded-lg bg-secondary p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Events */}
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
          <div className="space-y-4">
            {organizerEvents.map((event) => {
              const soldPercentage = Math.round(
                (event.soldTickets / event.totalTickets) * 100
              );
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
                      <p className="font-semibold">${eventRevenue.toLocaleString()}</p>
                    </div>
                    <Badge
                      variant={soldPercentage >= 90 ? "destructive" : soldPercentage >= 50 ? "default" : "secondary"}
                    >
                      {soldPercentage}% sold
                    </Badge>
                    <div className="flex gap-2">
                      <Link href={`/events/${event.id}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Sales</CardTitle>
          <Link href="/organizer/sales">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{ticket.buyerDisplayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.ticketTypeName} - {ticket.eventTitle}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${ticket.totalPaid.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ticket.purchasedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
