import { Event, Banner, Ticket, StaffMember, PayoutRequest, Organizer, User } from "./types";

// Events are stored in localStorage via lib/events-store.ts
// This array intentionally empty — no dummy/test events
export const mockEvents: Event[] = [];

export const mockOrganizers: Organizer[] = [];

export const mockBanners: Banner[] = [
  {
    id: "ban-001",
    type: "hero",
    position: 1,
    image: "",
    link: "/events/evt-001",
    title: "Ghettocracy Comedy Night - Get Your Tickets Now!",
    organizerId: "org-001",
    startDate: "2024-11-01",
    endDate: "2024-12-15",
    pricePerDay: 20,
    status: "available",
  },
  {
    id: "ban-002",
    type: "hero",
    position: 2,
    image: "",
    link: "/events/evt-003",
    title: "Jah Prayzah Live - Don't Miss Out!",
    organizerId: "org-003",
    startDate: "2024-11-15",
    endDate: "2024-12-22",
    pricePerDay: 20,
    status: "available",
  },
  {
    id: "ban-003",
    type: "hero",
    position: 3,
    image: "",
    link: "",
    title: "",
    pricePerDay: 20,
    status: "available",
  },
  {
    id: "ban-004",
    type: "hero",
    position: 4,
    image: "",
    link: "",
    title: "",
    pricePerDay: 20,
    status: "available",
  },
  {
    id: "ban-005",
    type: "hero",
    position: 5,
    image: "",
    link: "",
    title: "",
    pricePerDay: 20,
    status: "available",
  },
  {
    id: "ban-section-001",
    type: "section",
    position: 1,
    image: "",
    link: "",
    title: "",
    pricePerDay: 10,
    status: "available",
  },
  {
    id: "ban-section-002",
    type: "section",
    position: 2,
    image: "",
    link: "",
    title: "",
    pricePerDay: 10,
    status: "available",
  },
  {
    id: "ban-section-003",
    type: "section",
    position: 3,
    image: "",
    link: "",
    title: "",
    pricePerDay: 10,
    status: "available",
  },
];

// Tickets are stored via payment service — no dummy tickets
export const mockTickets: Ticket[] = [];

export const mockStaffMembers: StaffMember[] = [];

export const mockPayoutRequests: PayoutRequest[] = [];

export function getEventsByCategory(category: string): Event[] {
  if (category === "all") return mockEvents.filter((e) => e.status === "published");
  return mockEvents.filter((e) => e.category === category && e.status === "published");
}

export function getEventById(id: string): Event | undefined {
  return mockEvents.find((e) => e.id === id);
}

export function getNewestEvents(count = 8): Event[] {
  return mockEvents
    .filter((e) => e.status === "published")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, count);
}

export function getFeaturedEvents(): Event[] {
  return mockEvents
    .filter((e) => e.status === "published")
    .sort((a, b) => b.soldTickets - a.soldTickets)
    .slice(0, 4);
}

export function getUpcomingEvents(): Event[] {
  const now = new Date();
  return mockEvents
    .filter((e) => e.status === "published" && new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getActiveBanners(type: "hero" | "section"): Banner[] {
  return mockBanners.filter((b) => b.type === type);
}

export function getTicketsByEvent(eventId: string): Ticket[] {
  return mockTickets.filter((t) => t.eventId === eventId);
}

export function getStaffByOrganizer(organizerId: string): StaffMember[] {
  return mockStaffMembers.filter((s) => s.organizerId === organizerId);
}

export function getPayoutsByOrganizer(organizerId: string): PayoutRequest[] {
  return mockPayoutRequests.filter((p) => p.organizerId === organizerId);
}

export const mockUsers: User[] = [];
