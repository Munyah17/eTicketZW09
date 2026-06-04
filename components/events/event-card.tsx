"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Event, EVENT_CATEGORIES } from "@/lib/types";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  variant?: "default" | "compact";
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
  const lowestPrice = Math.min(...event.ticketTypes.map((t) => t.price));
  const availableTickets = event.totalTickets - event.soldTickets;
  const soldPercentage = Math.round((event.soldTickets / event.totalTickets) * 100);
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
    <Link href={`/events/${event.id}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg">
        {/* Image placeholder with gradient */}
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent">
          <div className="absolute inset-0 flex items-center justify-center">
            <Ticket className="h-12 w-12 text-primary/30" />
          </div>
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
          {availableTickets === 0 && (
            <Badge className="absolute right-3 top-3 bg-destructive text-destructive-foreground">
              Sold Out
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight group-hover:text-primary transition-colors text-balance">
            {event.title}
          </h3>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{formatDate(event.date)} at {event.time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.soldTickets} sold
              </span>
              <span>{soldPercentage}% sold</span>
            </div>
            <div className="mt-1">
              <ProgressBar
                value={soldPercentage}
                className="h-1.5"
                barClassName={cn(
                  soldPercentage >= 90 ? "bg-destructive" : soldPercentage >= 70 ? "bg-warning" : "bg-success"
                )}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground">From</span>
              <p className="text-lg font-bold text-primary">${lowestPrice}</p>
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
