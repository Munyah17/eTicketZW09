"use client";

import { useState } from "react";
import Link from "next/link";
import { TicketPurchaseForm } from "@/components/events/ticket-purchase-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Share2,
  Heart,
  Ticket,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import type { Event } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/types";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

interface EventDetailClientProps {
  event: Event;
}

export function EventDetailClient({ event }: EventDetailClientProps) {
  const [selectedTicketType, setSelectedTicketType] = useState<string | null>(null);

  const handleTicketSelect = (ticketTypeId: string) => {
    setSelectedTicketType(ticketTypeId);
    if (window.innerWidth < 1024) {
      document.getElementById("ticket-purchase-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === event.category)?.label || event.category;
  const availableTickets = event.totalTickets - event.soldTickets;
  const soldPercentage = event.totalTickets > 0
    ? Math.round((event.soldTickets / event.totalTickets) * 100)
    : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZW", {
      weekday: "long",
      day: "numeric",
      month: "long",
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

  return (
    <main className="flex-1">
      <div className="border-b bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Events
          </Link>
        </div>
      </div>

      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Ticket className="h-20 w-20 text-primary/30" />
                </div>
                <Badge className="absolute left-4 top-4 bg-background/90 text-foreground">
                  {categoryLabel}
                </Badge>
                {availableTickets < 50 && availableTickets > 0 && (
                  <Badge className="absolute right-4 top-4 bg-warning text-warning-foreground">
                    Only {availableTickets} tickets left!
                  </Badge>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-6">
                  <Badge variant="outline" className="mb-3">
                    {categoryLabel}
                  </Badge>
                  <h1 className="text-2xl font-bold leading-tight text-balance">{event.title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {event.platformNegotiated?.isPlatformEvent
                      ? `Organized by E-TicketsZW on behalf of ${event.platformNegotiated.originalOrganizerName}`
                      : `by ${event.organizerName}`}
                  </p>
                  {event.organizerCategory && (
                    <p className="mt-1 text-xs text-primary">
                      {event.organizerCategory}
                      {event.organizerSubtype && ` · ${event.organizerSubtype}`}
                    </p>
                  )}

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{formatDate(event.date)}</p>
                        <p className="text-sm text-muted-foreground">Date</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{formatTime(event.time)}</p>
                        <p className="text-sm text-muted-foreground">Doors Open</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{event.venue}</p>
                        <p className="text-sm text-muted-foreground">{event.city}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg bg-secondary/50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {event.soldTickets} tickets sold
                      </span>
                      <span className="font-medium">{soldPercentage}%</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        value={soldPercentage}
                        barClassName={cn(
                          soldPercentage >= 90 ? "bg-destructive" : soldPercentage >= 70 ? "bg-warning" : "bg-success"
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <Button variant="outline" size="icon">
                      <Heart className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                      onClick={() => document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })}
                    >
                      <Ticket className="h-4 w-4" />
                      Get Tickets
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="text-xl font-bold">About This Event</h2>
              <p className="mt-4 leading-relaxed text-muted-foreground whitespace-pre-line">
                {event.description}
              </p>
            </div>

            <div id="tickets">
              <h2 className="text-xl font-bold">Select Tickets</h2>
              <div className="mt-4 space-y-4">
                {event.ticketTypes.map((ticketType) => {
                  const available = ticketType.quantity - ticketType.sold;
                  const isSelected = selectedTicketType === ticketType.id;

                  return (
                    <Card
                      key={ticketType.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-primary/5",
                        available === 0 && "opacity-50 cursor-not-allowed hover:shadow-none"
                      )}
                      onClick={() => { if (available > 0) handleTicketSelect(ticketType.id); }}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{ticketType.name}</h3>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{ticketType.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {available > 0 ? `${available} available` : "Sold out"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${ticketType.price.toFixed(2)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold">Venue</h2>
              <Card className="mt-4">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{event.venue}</h3>
                      <p className="text-sm text-muted-foreground">{event.city}, Zimbabwe</p>
                      <Button variant="link" className="h-auto p-0 text-primary">
                        Get Directions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div id="ticket-purchase-form" className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <TicketPurchaseForm
                event={event}
                selectedTicketTypeId={selectedTicketType}
                onTicketTypeChange={setSelectedTicketType}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
