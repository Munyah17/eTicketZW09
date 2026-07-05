"use client";

import { useState, useEffect, useCallback } from "react";
import type { Event } from "@/lib/types";
import {
  FeaturedSection,
  NewestEventsSection,
  CategorySection,
  UpcomingSection,
} from "@/components/home/category-section";
import { SectionBanner } from "@/components/home/section-banner";

type HomeSections = {
  featured: Event[];
  newest: Event[];
  upcoming: Event[];
  comedy: Event[];
  music: Event[];
  sports: Event[];
  marathon: Event[];
  conference: Event[];
  workshop: Event[];
  festival: Event[];
  theater: Event[];
  exhibition: Event[];
  other: Event[];
};

const EMPTY: HomeSections = {
  featured: [], newest: [], upcoming: [],
  comedy: [], music: [], sports: [], marathon: [],
  conference: [], workshop: [], festival: [], theater: [],
  exhibition: [], other: [],
};

export function EventSections() {
  const [sections, setSections] = useState<HomeSections>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/events/home");
      if (res.ok) setSections(await res.json());
    } catch (e) {
      console.error("EventSections:", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("eticket:events-updated", load);
    return () => window.removeEventListener("eticket:events-updated", load);
  }, [load]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 text-center text-muted-foreground">
        Loading events…
      </div>
    );
  }

  const hasEvents = sections.featured.length > 0 || sections.newest.length > 0;

  if (!hasEvents) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 text-center">
        <h2 className="text-2xl font-bold">No Events Yet</h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Be the first to list an event on E-TicketsZW. Organizers can create events from their dashboard.
        </p>
      </section>
    );
  }

  return (
    <>
      <FeaturedSection events={sections.featured} />
      <NewestEventsSection events={sections.newest} />
      <SectionBanner position={1} />
      <CategorySection category="comedy" events={sections.comedy} />
      <CategorySection category="music" events={sections.music} />
      <SectionBanner position={2} />
      <CategorySection category="sports" events={sections.sports} />
      <CategorySection category="marathon" events={sections.marathon} />
      <SectionBanner position={3} />
      <CategorySection category="conference" events={sections.conference} />
      <CategorySection category="workshop" events={sections.workshop} />
      <SectionBanner position={4} />
      <CategorySection category="festival" events={sections.festival} />
      <CategorySection category="theater" events={sections.theater} />
      <SectionBanner position={5} />
      <CategorySection category="exhibition" events={sections.exhibition} />
      <CategorySection category="other" events={sections.other} />
      <SectionBanner position={6} />
      <UpcomingSection events={sections.upcoming} />
      <SectionBanner position={7} />
    </>
  );
}
