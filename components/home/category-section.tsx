import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { Event, EventCategory, EVENT_CATEGORIES } from "@/lib/types";

interface CategorySectionProps {
  category: EventCategory;
  events: Event[];
  showAll?: boolean;
}

export function CategorySection({ category, events, showAll = false }: CategorySectionProps) {
  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === category)?.label || category;
  const displayEvents = showAll ? events : events.slice(0, 4);

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{categoryLabel}</h2>
          <p className="mt-1 text-muted-foreground">
            {events.length} upcoming {events.length === 1 ? "event" : "events"}
          </p>
        </div>
        <Link href={`/events?category=${category}`}>
          <Button variant="ghost" className="gap-1 text-primary hover:text-primary/80">
            Show More
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {displayEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

export function FeaturedSection({ events, title = "Featured Events" }: { events: Event[]; title?: string }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
          <p className="mt-1 text-muted-foreground">
            Trending events you don&apos;t want to miss
          </p>
        </div>
        <Link href="/events">
          <Button variant="ghost" className="gap-1 text-primary hover:text-primary/80">
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 4 columns × 2 rows = 8 events on desktop */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {events.slice(0, 8).map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

export function NewestEventsSection({ events }: { events: Event[] }) {
  if (events.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">Newest Events</h2>
          <p className="mt-1 text-muted-foreground">The latest events added to the platform</p>
        </div>
        <Link href="/events?sort=newest">
          <Button variant="ghost" className="gap-1 text-primary hover:text-primary/80">
            View Latest
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 4 columns × 2 rows = 8 events */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {events.slice(0, 8).map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

export function UpcomingSection({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">Coming Soon</h2>
          <p className="mt-1 text-muted-foreground">
            Get your tickets before they sell out
          </p>
        </div>
        <Link href="/events">
          <Button variant="ghost" className="gap-1 text-primary hover:text-primary/80">
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.slice(0, 6).map((event) => (
          <EventCard key={event.id} event={event} variant="compact" />
        ))}
      </div>
    </section>
  );
}
