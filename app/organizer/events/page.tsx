"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Calendar,
  Ticket,
  DollarSign,
  Plus,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrganizerEvents } from "@/lib/events-store";
import { Event } from "@/lib/types";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, inDateRange } from "@/components/ui/date-range-filter";
import type { ExportColumn } from "@/lib/export-utils";

export default function OrganizerEventsPage() {
  const { user } = useAuth();
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const events = await getOrganizerEvents(user.id);
      setOrganizerEvents(events);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEvents();
    const refresh = () => { loadEvents(); };
    window.addEventListener("eticket:events-updated", refresh);
    return () => window.removeEventListener("eticket:events-updated", refresh);
  }, [loadEvents]);

  const filteredEvents = organizerEvents.filter(
    (event) =>
      (event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue.toLowerCase().includes(searchQuery.toLowerCase())) &&
      inDateRange(event.date, dateFrom, dateTo)
  );

  const exportColumns: ExportColumn<Event>[] = [
    { header: "Title", accessor: (e) => e.title },
    { header: "Category", accessor: (e) => e.category },
    { header: "Date", accessor: (e) => e.date },
    { header: "Venue", accessor: (e) => e.venue },
    { header: "City", accessor: (e) => e.city },
    { header: "Status", accessor: (e) => e.status },
    { header: "Total Tickets", accessor: (e) => e.totalTickets },
    { header: "Sold Tickets", accessor: (e) => e.soldTickets },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge variant="default" className="bg-success text-success-foreground">Published</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending_review":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Review</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stats = [
    {
      title: "Total Events",
      value: organizerEvents.length,
      icon: Calendar,
    },
    {
      title: "Published",
      value: organizerEvents.filter((e) => e.status === "published").length,
      icon: Eye,
    },
    {
      title: "Total Tickets",
      value: organizerEvents.reduce((sum, e) => sum + e.totalTickets, 0),
      icon: Ticket,
    },
    {
      title: "Total Revenue",
      value: `$${organizerEvents.reduce((sum, e) => sum + e.ticketTypes.reduce((s, t) => s + t.sold * t.price, 0), 0).toLocaleString()}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="text-muted-foreground">
            Manage and track all your events
          </p>
        </div>
        <Link href="/organizer/create">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} label={stat.title} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <ExportMenu rows={filteredEvents} columns={exportColumns} filename="events" title="My Events" />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Venue</TableHead>
                  <TableHead className="whitespace-nowrap">Tickets</TableHead>
                  <TableHead className="whitespace-nowrap">Revenue</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading events…
                    </TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => {
                    const soldPercentage = event.totalTickets > 0
                      ? Math.round((event.soldTickets / event.totalTickets) * 100)
                      : 0;
                    const revenue = event.ticketTypes.reduce(
                      (sum, t) => sum + t.sold * t.price,
                      0
                    );
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.category}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">
                            <p>{new Date(event.date).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "numeric" })}</p>
                            <p className="text-xs text-muted-foreground">{event.time}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{event.venue}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <p className="font-medium">
                              {event.soldTickets}/{event.totalTickets}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {soldPercentage}% sold
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">${revenue.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{getStatusBadge(event.status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Link href={`/events/${event.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
