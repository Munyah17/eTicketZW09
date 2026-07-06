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
}

export function EventCard({ event, variant = "default", fastSelling = false }: EventCardProps) {
  const lowestPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map((t) => t.price)) : 0;
  const availableTickets = event.totalTickets - event.soldTickets;
  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === event.category)?.label || event.category;

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
    <Link href={`/events/${event.id}`} className="block h-full">
      <Card className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
        {/* Cover image — uniform aspect ratio so every card lines up, falls back to a gradient placeholder */}
        <div className="relative aspect-[2/1] shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent">
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 90vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Ticket className="h-10 w-10 text-primary/30" />
            </div>
          )}
          {/* Category badge */}
          <Badge className="absolute left-3 top-3 bg-background/90 text-foreground hover:bg-background/90">
            {categoryLabel}
          </Badge>
          {/* Availability indicator */}
          {availableTickets < 50 && availableTickets > 0 && (
            <Badge className="absolute right-3 top-3 bg-warning text-warning-foreground">
              Only {availableTickets} left!
            </Badge>
          )}
          {availableTickets === 0 && event.totalTickets > 0 && (
            <Badge className="absolute right-3 top-3 bg-destructive text-destructive-foreground">
              Sold Out
            </Badge>
          )}
          {fastSelling && availableTickets > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-1 text-white shadow-md">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Selling Fast</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-3.5">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight text-balance group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatDate(event.date)} · {event.time}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3">
            <div>
              <span className="text-xs text-muted-foreground">From</span>
              <p className="text-lg font-heading font-bold text-primary">${lowestPrice}</p>
            </div>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Get Tickets
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
