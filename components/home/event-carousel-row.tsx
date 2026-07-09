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
  fastSellingBadge?: boolean;
}

const GAP = 16;

// Cards fully in view at each breakpoint + half-card peeks on both sides
// Desktop (1024+): 4 cards center + 0.5 card peek each side = shows 5 cards (4 full + 2 half)
// Tablet (640+): 2 cards center + 0.5 card peek each side = shows 3 cards (2 full + 2 half)
// Mobile: 1 card center + 0.5 card peek each side = shows 2 cards (1 full + 2 half)
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
  fastSellingBadge = false,
}: EventCarouselRowProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
  const isMobile = cardsPerView === 1;
  // At sm/lg breakpoints we intentionally show a half-card "peek" of the next
  // slide as a scroll affordance. On mobile that peek reads as a second
  // column, so mobile gets exactly one full-width card per view instead.
  const slots = isMobile ? cardsPerView : cardsPerView + 1;
  const cardWidth = viewportWidth > 0
    ? isMobile
      ? viewportWidth
      : (viewportWidth - (cardsPerView * GAP)) / slots
    : 0;
  const step = cardWidth + GAP;

  const trackWidth = events.length * (cardWidth + GAP) - GAP;
  const maxOffset = Math.max(0, trackWidth - viewportWidth);
  const maxIndex = Math.max(0, events.length - cardsPerView);

  const rawOffset = isMobile ? index * step : (index - 0.5) * step;
  const offset = Math.min(Math.max(rawOffset, 0), maxOffset);

  const canScrollPrev = index > 0;
  const canScrollNext = index < maxIndex;

  const SWIPE_THRESHOLD = 40;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Only hijack horizontal swipes — vertical page scroll passes through untouched.
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragDelta(dx);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragDelta) > SWIPE_THRESHOLD) {
      if (dragDelta < 0) setIndex((i) => Math.min(maxIndex, i + 1));
      else setIndex((i) => Math.max(0, i - 1));
    }
    setDragDelta(0);
    setIsDragging(false);
    touchStartRef.current = null;
  };

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

      <div
        ref={viewportRef}
        className="relative mt-6 overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={isDragging ? "flex" : "flex transition-transform duration-300 ease-out"}
          style={{ gap: GAP, transform: `translateX(-${offset - dragDelta}px)` }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className="w-full shrink-0 grow-0 sm:w-1/3 lg:w-1/5"
              style={viewportWidth > 0 ? { width: cardWidth, flexBasis: cardWidth } : undefined}
            >
              <EventCard event={event} variant={cardVariant} fastSelling={fastSellingBadge} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
