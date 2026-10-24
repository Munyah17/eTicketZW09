"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

  // Both promo types ("video" and "slideshow") resolve to a single rendered video URL
  const promoVideoUrl = event.promoVideo?.url;

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
            href="/allevents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Events
          </Link>
        </div>
      </div>

      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {/* Featured Image */}
              <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent">
                {event.image ? (
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ticket className="h-20 w-20 text-primary/30" />
                  </div>
                )}
                <Badge className="absolute left-4 top-4 bg-background/90 text-foreground">
                  {categoryLabel}
                </Badge>
                {availableTickets < 50 && availableTickets > 0 && (
                  <Badge className="absolute right-4 top-4 bg-warning text-warning-foreground">
                    Only {availableTickets} tickets left!
                  </Badge>
                )}
              </div>

              {/* Promo Video */}
              {promoVideoUrl && (
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                  <video
                    src={promoVideoUrl}
                    poster={event.promoVideo?.thumbnail}
                    controls
                    preload="metadata"
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-5">
                  <Badge variant="outline" className="mb-2">
                    {categoryLabel}
                  </Badge>
                  <h1 className="text-xl font-bold leading-tight text-balance">{event.title}</h1>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{formatDate(event.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{formatTime(event.time)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{event.venue}, {event.city}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-secondary/50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {event.soldTickets} tickets sold
                      </span>
                      <span className="font-medium">{soldPercentage}%</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={soldPercentage}
                        barClassName={cn(
                          soldPercentage >= 90 ? "bg-destructive" : soldPercentage >= 70 ? "bg-warning" : "bg-success"
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-bold">About This Event</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {event.description}
              </p>
            </div>

            <div id="ticket-purchase-form">
              <TicketPurchaseForm
                event={event}
                selectedTicketTypeId={selectedTicketType}
                onTicketTypeChange={setSelectedTicketType}
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div id="tickets">
                <h2 className="text-lg font-bold mb-3">Select Tickets</h2>
                <div className="space-y-3">
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
                        <CardContent className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold">{ticketType.name}</h3>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary" />}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{ticketType.description}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {available > 0 ? `${available} available` : "Sold out"}
                            </p>
                          </div>
                          <div className="ml-2 shrink-0 text-right">
                            <p className="text-base font-heading font-bold">${ticketType.price.toFixed(2)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
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
                  <Button variant="link" className="h-auto p-0 text-primary" asChild>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.city}, Zimbabwe`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Directions
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
