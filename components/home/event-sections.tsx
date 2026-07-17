"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import type { Event, EventCategory } from "@/lib/types";
import {
  FeaturedSection,
  BestSellingSection,
  CategorySection,
  UpcomingSection,
} from "@/components/home/category-section";
import { SectionBanner } from "@/components/home/section-banner";

type HomeSections = {
  featured: Event[];
  bestSelling: Event[];
  comingSoon: Event[];
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
  featured: [], bestSelling: [], comingSoon: [],
  comedy: [], music: [], sports: [], marathon: [],
  conference: [], workshop: [], festival: [], theater: [],
  exhibition: [], other: [],
};

// Homepage order: Featured, Best Selling, then every category, then Coming
// Soon last — a banner slot follows every single section (13 total).
const CATEGORY_ORDER: EventCategory[] = [
  "comedy", "music", "sports", "marathon", "conference",
  "workshop", "festival", "theater", "exhibition", "other",
];

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

  const hasEvents = sections.featured.length > 0 || sections.bestSelling.length > 0;

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

  // Every section below is paired with the banner slot that follows it, but
  // a section with zero events renders nothing (EventCarouselRow returns
  // null) — while SectionBanner always renders *something* (a real ad, or
  // the "Advertise Here" placeholder). Left unpaired, an empty category
  // between two non-empty ones collapsed to nothing, leaving its banner
  // sitting directly against the next section's banner with no category
  // visible between them. Gating each banner on its section actually having
  // content keeps every banner anchored to a category that's really there.
  return (
    <>
      {sections.featured.length > 0 && (
        <>
          <FeaturedSection events={sections.featured} />
          <SectionBanner position={1} />
        </>
      )}
      {sections.bestSelling.length > 0 && (
        <>
          <BestSellingSection events={sections.bestSelling} />
          <SectionBanner position={2} />
        </>
      )}
      {CATEGORY_ORDER.map((category, i) =>
        sections[category].length > 0 ? (
          <Fragment key={category}>
            <CategorySection category={category} events={sections[category]} />
            <SectionBanner position={i + 3} />
          </Fragment>
        ) : null
      )}
      {sections.comingSoon.length > 0 && (
        <>
          <UpcomingSection events={sections.comingSoon} />
          <SectionBanner position={13} />
        </>
      )}
    </>
  );
}
