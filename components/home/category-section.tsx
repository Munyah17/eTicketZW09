import { EventCarouselRow } from "@/components/home/event-carousel-row";
import { Event, EventCategory, EVENT_CATEGORIES } from "@/lib/types";

interface CategorySectionProps {
  category: EventCategory;
  events: Event[];
}

export function CategorySection({ category, events }: CategorySectionProps) {
  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === category)?.label || category;

  return (
    <EventCarouselRow
      title={categoryLabel}
      subtitle={`${events.length} upcoming ${events.length === 1 ? "event" : "events"}`}
      viewAllHref={`/events?category=${category}`}
      events={events}
    />
  );
}

export function FeaturedSection({ events, title = "Featured Events" }: { events: Event[]; title?: string }) {
  return (
    <EventCarouselRow
      title={title}
      subtitle="Trending events you don't want to miss"
      viewAllHref="/events"
      events={events}
    />
  );
}

export function NewestEventsSection({ events }: { events: Event[] }) {
  return (
    <EventCarouselRow
      title="Newest Events"
      subtitle="The latest events added to the platform"
      viewAllHref="/events?sort=newest"
      viewAllLabel="View Latest"
      events={events}
    />
  );
}

export function UpcomingSection({ events }: { events: Event[] }) {
  return (
    <EventCarouselRow
      title="Coming Soon"
      subtitle="Get your tickets before they sell out"
      viewAllHref="/events"
      events={events}
    />
  );
}
