import { Event } from "./types";

const EVENTS_STORE_KEY = "eticket_events";

// Dispatches a same-tab custom event so any mounted listener can refresh immediately.
// (The native "storage" event only fires in other tabs, not the current one.)
function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eticket:events-updated"));
  }
}

export function getStoredEvents(): Event[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(EVENTS_STORE_KEY);
    return stored ? (JSON.parse(stored) as Event[]) : [];
  } catch {
    return [];
  }
}

export function saveEvent(event: Event): void {
  if (typeof window === "undefined") return;
  const events = getStoredEvents();
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    events[idx] = event;
  } else {
    events.push(event);
  }
  localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(events));
  notifyChange();
}

export function deleteStoredEvent(id: string): void {
  if (typeof window === "undefined") return;
  const events = getStoredEvents().filter((e) => e.id !== id);
  localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(events));
  notifyChange();
}

export function getOrganizerEvents(organizerId: string): Event[] {
  return getStoredEvents().filter((e) => e.organizerId === organizerId);
}

export function getPublishedEvents(): Event[] {
  return getStoredEvents().filter((e) => e.status === "published");
}

export function getFeaturedEvents(count = 8): Event[] {
  return getPublishedEvents()
    .sort((a, b) => b.soldTickets - a.soldTickets)
    .slice(0, count);
}

export function getNewestEvents(count = 8): Event[] {
  return getPublishedEvents()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, count);
}

export function getEventsByCategory(category: string): Event[] {
  return getPublishedEvents().filter((e) => e.category === category);
}

export function getUpcomingEvents(): Event[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return getPublishedEvents()
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getEventById(id: string): Event | undefined {
  return getStoredEvents().find((e) => e.id === id);
}
