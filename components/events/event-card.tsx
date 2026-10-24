"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Ticket, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Event, EVENT_CATEGORIES } from "@/lib/types";

interface EventCardProps {
  event: Event;
  variant?: "default" | "compact";
  fastSelling?: boolean;
  statusTag?: { label: string; className: string } | null;
}

export function EventCard({ event, variant = "default", fastSelling = false, statusTag }: EventCardProps) {
  const lowestPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map((t) => t.price)) : 0;
  const availableTickets = event.totalTickets - event.soldTickets;
  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === event.category)?.label || event.category;

  // Only show "Selling Fast" if: fastSelling is true AND event actually meets selling criteria
  // Criteria: sold >= 70% of tickets AND sold at least 10 tickets
  const shouldShowSellFast = fastSelling && event.soldTickets >= 10 && event.totalTickets > 0 && (event.soldTickets / event.totalTickets) >= 0.7;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZW", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (variant === "compact") {
    return (
      <Link href={`/events/${event.id}`}>
        <Card className="group overflow-hidden transition-all hover:shadow-md">
          <div className="flex gap-4 p-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-center">
              <span className="text-xs font-medium text-primary">
                {new Date(event.date).toLocaleDateString("en-ZW", { month: "short" })}
              </span>
              <span className="text-lg font-bold text-primary">
                {new Date(event.date).getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold group-hover:text-primary transition-colors">
                {event.title}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.venue}</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {categoryLabel}
                </Badge>
                <span className="text-sm font-medium text-primary">
                  From ${lowestPrice}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/events/${event.id}`} className="block">
      <Card className="group flex w-full flex-col overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl pt-0 pb-6 sm:h-[450px]">
        {/* Cover image — aspect-scaled on narrow (mobile) cards, fixed 210px at sm+ */}
        <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent sm:aspect-auto sm:h-[210px]">
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 45vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              quality={85}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Ticket className="h-10 w-10 text-primary/30" />
            </div>
          )}
          {/* Category badge */}
          <Badge className="absolute left-3 top-3 bg-background/90 text-foreground hover:bg-background/90 backdrop-blur-sm">
            {categoryLabel}
          </Badge>
          {/* Availability indicator — a passed-in statusTag (used on the All
              Events page) takes over this corner entirely, since it already
              covers sold-out/almost-sold-out plus ended/cancelled/hot-selling. */}
          {statusTag ? (
            <Badge className={`absolute right-3 top-3 ${statusTag.className} backdrop-blur-sm`}>
              {statusTag.label}
            </Badge>
          ) : (
            <>
              {availableTickets < 50 && availableTickets > 0 && (
                <Badge className="absolute right-3 top-3 bg-warning text-warning-foreground backdrop-blur-sm">
                  Only {availableTickets} left!
                </Badge>
              )}
              {availableTickets === 0 && event.totalTickets > 0 && (
                <Badge className="absolute right-3 top-3 bg-destructive text-destructive-foreground backdrop-blur-sm">
                  Sold Out
                </Badge>
              )}
            </>
          )}
          {shouldShowSellFast && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-1 text-white shadow-md backdrop-blur-sm">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Selling Fast</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-3 sm:h-[240px] sm:p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-balance group-hover:text-primary transition-colors duration-200">
            {event.title}
          </h3>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatDate(event.date)} · {event.time}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          {/* Tickets Sold Progress Bar */}
          {event.totalTickets > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Tickets Sold</span>
                <span className="font-semibold text-primary">{event.soldTickets}/{event.totalTickets}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
                  style={{ width: `${(event.soldTickets / event.totalTickets) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground">From</span>
              <p className="truncate text-sm font-heading font-bold text-primary">${lowestPrice}</p>
            </div>
            <Button size="sm" className="shrink-0 whitespace-nowrap bg-primary hover:bg-primary/90 text-[11px] px-2.5 h-8 transition-all duration-200 ease-out hover:scale-105 sm:text-xs sm:px-4">
              Get Tickets
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
