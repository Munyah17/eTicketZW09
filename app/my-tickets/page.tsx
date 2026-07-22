"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface MyTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  ticketTypeName: string;
  buyerName: string;
  buyerDisplayName: string;
  totalPaid: number;
  currency: string;
  paymentMethod: string;
  validated: boolean;
  purchasedAt: string;
}

export default function MyTicketsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetch("/api/tickets/mine")
      .then((r) => r.json())
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  useEffect(() => {
    const generateQRCodes = async () => {
      const codes: Record<string, string> = {};
      for (const ticket of tickets) {
        codes[ticket.id] = await QRCode.toDataURL(
          JSON.stringify({ ticketId: ticket.id, eventId: ticket.eventId }),
          { width: 150, margin: 1 }
        );
      }
      setQrCodes(codes);
    };
    if (tickets.length > 0) generateQRCodes();
  }, [tickets]);

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZW", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      stripe: "Stripe (Card)",
      paynow: "Paynow",
      ecocash: "EcoCash",
      innbucks: "InnBucks",
      visa: "Visa Card",
      mastercard: "Mastercard",
    };
    return methods[method] || method;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Tickets</h1>
              <p className="text-muted-foreground">
                View and manage your purchased tickets
              </p>
            </div>
            <Link href="/allevents">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Ticket className="h-4 w-4" />
                Browse Events
              </Button>
            </Link>
          </div>

          {/* Search */}
          <div className="mt-6">
            <Label htmlFor="search" className="sr-only">
              Search tickets
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by event name or ticket ID..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Tickets List */}
          <div className="mt-8 space-y-6">
            {authLoading || loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-4 text-muted-foreground">Loading tickets…</p>
              </div>
            ) : !user ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Ticket className="h-16 w-16 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Sign in to see your tickets</h3>
                <p className="mt-2 text-muted-foreground">
                  Log in with the account you used at checkout to view purchased tickets
                </p>
                <Link href="/login">
                  <Button className="mt-4">Log In</Button>
                </Link>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Ticket className="h-16 w-16 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No tickets found</h3>
                <p className="mt-2 text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "You haven't purchased any tickets yet"}
                </p>
                <Link href="/allevents">
                  <Button className="mt-4">Browse Events</Button>
                </Link>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Ticket Info */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ticket.validated ? "secondary" : "default"}>
                              {ticket.ticketTypeName}
                            </Badge>
                            {ticket.validated ? (
                              <Badge variant="outline" className="gap-1 text-warning border-warning">
                                <AlertCircle className="h-3 w-3" />
                                Used
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-success border-success">
                                <CheckCircle2 className="h-3 w-3" />
                                Valid
                              </Badge>
                            )}
                          </div>
                          <h3 className="mt-2 text-lg font-semibold">
                            {ticket.eventTitle}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(ticket.eventDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatTime(ticket.eventTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{ticket.venue}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-secondary/50 p-3">
                        <div className="grid gap-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ticket ID</span>
                            <span className="font-mono">{ticket.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name on Ticket</span>
                            <span>{ticket.buyerDisplayName || ticket.buyerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount Paid</span>
                            <span className="font-mono font-medium">
                              ${ticket.totalPaid.toFixed(2)} ({getPaymentMethodLabel(ticket.paymentMethod)})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Purchased</span>
                            <span>
                              {new Date(ticket.purchasedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center justify-center border-t p-6 lg:border-l lg:border-t-0">
                      {qrCodes[ticket.id] && (
                        <img
                          src={qrCodes[ticket.id]}
                          alt="Ticket QR Code"
                          className="h-[150px] w-[150px] rounded-lg border p-2"
                        />
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Show this at entry
                      </p>
                      <div className="mt-3 flex gap-2">
                        <a href={`/api/tickets/${ticket.id}/download`} download={`ticket-${ticket.id}.png`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-3 w-3" />
                            Download PNG
                          </Button>
                        </a>
                        <a href={`/api/tickets/${ticket.id}/wristband`} download={`wristband-${ticket.id}.png`}>
                          <Button variant="outline" size="sm" className="gap-2" title="Optional — gate staff have wristbands ready">
                            <Download className="h-3 w-3" />
                            Wristband
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
