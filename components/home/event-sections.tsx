"use client";

import { useState, useEffect, useCallback } from "react";
import type { Event } from "@/lib/types";
import {
  FeaturedSection,
  NewestEventsSection,
  CategorySection,
  UpcomingSection,
} from "@/components/home/category-section";
import { SectionBanner, AdvertiseCTA } from "@/components/home/section-banner";

type HomeSections = {
  featured: Event[];
  newest: Event[];
  upcoming: Event[];
  comedy: Event[];
  music: Event[];
  sports: Event[];
  marathon: Event[];
  festival: Event[];
};

const EMPTY: HomeSections = {
  featured: [], newest: [], upcoming: [],
  comedy: [], music: [], sports: [], marathon: [], festival: [],
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
      <SectionBanner position={1} />
      <NewestEventsSection events={sections.newest} />
      <SectionBanner position={2} />
      {sections.comedy.length > 0 && <CategorySection category="comedy" events={sections.comedy} />}
      {sections.music.length > 0 && <CategorySection category="music" events={sections.music} />}
      {sections.sports.length > 0 && <CategorySection category="sports" events={sections.sports} />}
      {sections.marathon.length > 0 && <CategorySection category="marathon" events={sections.marathon} />}
      <SectionBanner position={3} />
      {sections.festival.length > 0 && <CategorySection category="festival" events={sections.festival} />}
      {sections.upcoming.length > 0 && <UpcomingSection events={sections.upcoming} />}
      <AdvertiseCTA />
    </>
  );
}
