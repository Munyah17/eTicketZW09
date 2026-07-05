"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ExportMenu } from "@/components/ui/export-menu";
import type { ExportColumn } from "@/lib/export-utils";
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
  Ticket,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Download,
  RefreshCw,
} from "lucide-react";

type TicketRow = {
  id: string;
  event_title: string;
  event_date: string;
  ticket_type_name: string;
  buyer_name: string;
  buyer_display_name: string;
  buyer_contact: string;
  total_paid: number;
  currency: string;
  payment_status: string;
  validated: boolean;
  sale_type: string;
  purchased_at: string;
};

type Stats = {
  total: number;
  valid: number;
  used: number;
  revenue: number;
};

type ApiResponse = {
  stats: Stats;
  tickets: TicketRow[];
  total: number;
  page: number;
  pages: number;
};

const EMPTY_STATS: Stats = { total: 0, valid: 0, used: 0, revenue: 0 };

export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse>({
    stats: EMPTY_STATS,
    tickets: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Debounce search input to avoid firing on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/tickets?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const { stats, tickets, total, pages } = data;

  const getStatusBadge = (status: string, validated: boolean) => {
    if (validated) {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <CheckCircle2 className="h-3 w-3" />
          Used
        </Badge>
      );
    }
    switch (status) {
      case "completed":
        return (
          <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-0">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const statCards = [
    {
      title: "Total Tickets",
      value: stats.total,
      icon: Ticket,
      accent: "bg-blue-500",
      light: "bg-blue-50 text-blue-600",
    },
    {
      title: "Valid / Unused",
      value: stats.valid,
      icon: CheckCircle2,
      accent: "bg-emerald-500",
      light: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Used / Admitted",
      value: stats.used,
      icon: Calendar,
      accent: "bg-violet-500",
      light: "bg-violet-50 text-violet-600",
    },
    {
      title: "Total Revenue",
      value: `$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Download,
      accent: "bg-orange-500",
      light: "bg-orange-50 text-orange-600",
    },
  ];

  const onlineCount = tickets.filter((t) => t.sale_type === "online").length;
  const gateCount = tickets.filter((t) => t.sale_type === "gate").length;

  const exportColumns: ExportColumn<TicketRow>[] = [
    { header: "Ticket ID", accessor: (t) => t.id },
    { header: "Event", accessor: (t) => t.event_title },
    { header: "Event Date", accessor: (t) => t.event_date },
    { header: "Ticket Type", accessor: (t) => t.ticket_type_name },
    { header: "Buyer", accessor: (t) => t.buyer_display_name || t.buyer_name },
    { header: "Contact", accessor: (t) => t.buyer_contact },
    { header: "Amount", accessor: (t) => t.total_paid },
    { header: "Currency", accessor: (t) => t.currency },
    { header: "Status", accessor: (t) => t.payment_status },
    { header: "Validated", accessor: (t) => (t.validated ? "Yes" : "No") },
    { header: "Channel", accessor: (t) => t.sale_type },
    { header: "Purchased", accessor: (t) => t.purchased_at },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Tickets</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all tickets sold on the platform
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.title} label={s.title} value={loading ? "—" : s.value} icon={s.icon} iconClassName={s.light} />
        ))}
      </div>

      {/* Table card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <Ticket className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-base">Ticket List</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search event, buyer, or ticket ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <ExportMenu rows={tickets} columns={exportColumns} filename="tickets" title="All Tickets (current page)" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-6">Ticket</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin opacity-40" />
                    <p className="text-sm">Loading tickets…</p>
                  </TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {debouncedSearch ? "No tickets match your search" : "No tickets yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {debouncedSearch
                        ? "Try adjusting your search"
                        : "Tickets will appear here once customers complete purchases"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6">
                      <p className="font-mono text-xs text-muted-foreground">{ticket.id}</p>
                      <p className="text-xs font-medium mt-0.5">{ticket.ticket_type_name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm line-clamp-1">{ticket.event_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.event_date
                          ? new Date(ticket.event_date).toLocaleDateString("en-ZW", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {ticket.buyer_display_name?.charAt(0) ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ticket.buyer_display_name}</p>
                          <p className="text-xs text-muted-foreground">{ticket.buyer_contact}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono font-bold text-sm">${Number(ticket.total_paid).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{ticket.currency}</p>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ticket.payment_status, ticket.validated)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                          ticket.sale_type === "online"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ticket.sale_type === "online" ? "Online" : "Gate"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                      {ticket.purchased_at
                        ? new Date(ticket.purchased_at).toLocaleDateString("en-ZW", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Footer: count + pagination */}
          {!loading && tickets.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {total} ticket{total !== 1 ? "s" : ""} total ·{" "}
                <span className="text-blue-600 font-medium">{onlineCount} online</span>
                {" · "}
                <span className="font-medium">{gateCount} gate</span>
                {" (this page)"}
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <span>
                    Page {page} of {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
