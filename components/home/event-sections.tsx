"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Event } from "@/lib/types";
import { getStoredEvents } from "@/lib/events-store";
import {
  FeaturedSection,
  NewestEventsSection,
  CategorySection,
  UpcomingSection,
} from "@/components/home/category-section";
import { SectionBanner, AdvertiseCTA } from "@/components/home/section-banner";

// All filtering/sorting is derived from the events state so there is
// exactly one source of truth and the UI always stays consistent.
function derivesections(events: Event[]) {
  const published = events.filter((e) => e.status === "published");

  const featured = [...published]
    .sort((a, b) => b.soldTickets - a.soldTickets)
    .slice(0, 8);

  const newest = [...published]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = [...published]
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const byCategory = (cat: string) => published.filter((e) => e.category === cat);

  return {
    featured,
    newest,
    upcoming,
    comedy: byCategory("comedy"),
    music: byCategory("music"),
    sports: byCategory("sports"),
    marathon: byCategory("marathon"),
    festival: byCategory("festival"),
    hasEvents: published.length > 0,
  };
}

export function EventSections() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadEvents = useCallback(() => {
    setEvents(getStoredEvents());
    setLoaded(true);
  }, []);

  useEffect(() => {
    // Initial load
    loadEvents();

    // Refresh when saveEvent() is called in this tab (custom event)
    window.addEventListener("eticket:events-updated", loadEvents);
    // Refresh when the user switches back to this tab / window
    window.addEventListener("focus", loadEvents);

    return () => {
      window.removeEventListener("eticket:events-updated", loadEvents);
      window.removeEventListener("focus", loadEvents);
    };
  }, [loadEvents]);

  const sections = useMemo(() => derivesections(events), [events]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 text-center text-muted-foreground">
        Loading events…
      </div>
    );
  }

  if (!sections.hasEvents) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 text-center">
        <h2 className="text-2xl font-bold">No Events Yet</h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Be the first to list an event on E-TicketsZW. Organizers can create
          events from their dashboard.
        </p>
      </section>
    );
  }

  return (
    <>
      {/* Featured Events — 4 columns × 2 rows = 8 on desktop */}
      <FeaturedSection events={sections.featured} />

      {/* Banner Ad Slot 1 */}
      <SectionBanner position={1} />

      {/* Newest Events — sorted by creation date, 4 × 2 on desktop */}
      <NewestEventsSection events={sections.newest} />

      {/* Banner Ad Slot 2 */}
      <SectionBanner position={2} />

      {/* Comedy */}
      {sections.comedy.length > 0 && (
        <CategorySection category="comedy" events={sections.comedy} />
      )}

      {/* Music */}
      {sections.music.length > 0 && (
        <CategorySection category="music" events={sections.music} />
      )}

      {/* Sports */}
      {sections.sports.length > 0 && (
        <CategorySection category="sports" events={sections.sports} />
      )}

      {/* Marathon */}
      {sections.marathon.length > 0 && (
        <CategorySection category="marathon" events={sections.marathon} />
      )}

      {/* Banner Ad Slot 3 */}
      <SectionBanner position={3} />

      {/* Festival */}
      {sections.festival.length > 0 && (
        <CategorySection category="festival" events={sections.festival} />
      )}

      {/* Upcoming */}
      {sections.upcoming.length > 0 && (
        <UpcomingSection events={sections.upcoming} />
      )}

      {/* Advertise CTA */}
      <AdvertiseCTA />
    </>
  );
}
