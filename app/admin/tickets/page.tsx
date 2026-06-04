"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { mockTickets, mockEvents } from "@/lib/mock-data";

export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTickets = mockTickets.filter(
    (ticket) =>
      ticket.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 text-warning">
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

  const totalRevenue = mockTickets
    .filter((t) => t.paymentStatus === "completed")
    .reduce((sum, t) => sum + t.totalPaid, 0);

  const onlineCount = mockTickets.filter(t => t.saleType === "online").length;
  const gateCount   = mockTickets.filter(t => t.saleType === "gate").length;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Tickets</h1>
          <p className="text-muted-foreground mt-1">View and manage all tickets sold on the platform</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Tickets",   value: mockTickets.length, icon: Ticket,      accent: "bg-blue-500",    light: "bg-blue-50 text-blue-600" },
          { title: "Valid / Unused",  value: mockTickets.filter(t => !t.validated && t.paymentStatus === "completed").length, icon: CheckCircle2, accent: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
          { title: "Used / Admitted", value: mockTickets.filter(t => t.validated).length, icon: Calendar, accent: "bg-violet-500", light: "bg-violet-50 text-violet-600" },
          { title: "Total Revenue",   value: `$${totalRevenue.toLocaleString()}`, icon: Download, accent: "bg-orange-500", light: "bg-orange-50 text-orange-600" },
        ].map(s => (
          <Card key={s.title} className="border-0 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${s.accent}`} />
            <CardContent className="p-5 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.title}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.light}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
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
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search event, buyer, or ticket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
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
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No tickets found</p>
                    <p className="text-xs mt-1">Try adjusting your search</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6">
                      <p className="font-mono text-xs text-muted-foreground">{ticket.id}</p>
                      <p className="text-xs font-medium mt-0.5">{ticket.ticketTypeName}</p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/events/${ticket.eventId}`} className="font-medium text-sm hover:text-primary hover:underline underline-offset-2 transition-colors line-clamp-1">
                        {ticket.eventTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {ticket.buyerDisplayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ticket.buyerDisplayName}</p>
                          <p className="text-xs text-muted-foreground">{ticket.buyerContact}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-sm">${ticket.totalPaid.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{ticket.currency}</p>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ticket.paymentStatus, ticket.validated)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                        ticket.saleType === "online"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {ticket.saleType === "online" ? "Online" : "Gate"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-primary/5 hover:text-primary">
                        View <ArrowRight className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredTickets.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} shown</span>
              <span>
                <span className="text-blue-600 font-medium">{onlineCount} online</span>
                {" · "}
                <span className="font-medium">{gateCount} gate</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
