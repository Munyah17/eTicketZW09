"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { Event } from "@/lib/types";

interface EventCarouselRowProps {
  title: string;
  subtitle?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  events: Event[];
  cardVariant?: "default" | "compact";
}

const GAP = 16;

// Cards fully in view at each breakpoint — the carousel always shows one
// extra slide's worth of width split as a half-peek on each edge.
function cardsPerViewForWidth(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 640) return 2;
  return 1;
}

export function EventCarouselRow({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = "View All",
  events,
  cardVariant = "default",
}: EventCarouselRowProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setViewportWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    setViewportWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const cardsPerView = cardsPerViewForWidth(viewportWidth);
  const slots = cardsPerView + 1;
  const cardWidth = viewportWidth > 0
    ? (viewportWidth - (cardsPerView * GAP)) / slots
    : 0;
  const step = cardWidth + GAP;

  const trackWidth = events.length * (cardWidth + GAP) - GAP;
  const maxOffset = Math.max(0, trackWidth - viewportWidth);
  const maxIndex = Math.max(0, events.length - cardsPerView);

  const rawOffset = (index - 0.5) * step;
  const offset = Math.min(Math.max(rawOffset, 0), maxOffset);

  const canScrollPrev = index > 0;
  const canScrollNext = index < maxIndex;

  if (events.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={viewAllHref}>
            <Button variant="ghost" className="hidden gap-1 text-primary hover:text-primary/80 sm:inline-flex">
              {viewAllLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <button
            type="button"
            aria-label="Previous"
            disabled={!canScrollPrev}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canScrollNext}
            onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="relative mt-6 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ gap: GAP, transform: `translateX(-${offset}px)` }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className="w-1/2 shrink-0 grow-0 sm:w-1/3 lg:w-1/5"
              style={viewportWidth > 0 ? { width: cardWidth, flexBasis: cardWidth } : undefined}
            >
              <EventCard event={event} variant={cardVariant} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
