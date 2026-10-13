import { Suspense } from "react";
import { AllEventsPageContent } from "./all-events-content";
import { getPublishedEvents } from "@/lib/public-events";
import type { Event } from "@/lib/types";

export default async function AllEventsPage() {
  // Server-rendered from the shared cached layer — first paint already has
  // the full catalog grid, no spinner. On a DB hiccup we pass nothing and
  // the client falls back to fetching /api/events itself.
  let events: Event[] | undefined;
  try {
    events = await getPublishedEvents({ sort: "newest" });
  } catch {
    events = undefined;
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <AllEventsPageContent initialEvents={events} />
    </Suspense>
  );
}
