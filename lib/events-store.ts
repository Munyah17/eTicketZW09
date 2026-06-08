import { createClient } from "@/lib/supabase/client";
import { Event, EventCategory, OrganizerCategory, TicketType } from "./types";

// Notify same-tab listeners (Realtime handles cross-tab)
function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eticket:events-updated"));
  }
}

function dbToEvent(row: Record<string, unknown>): Event {
  const tts = (row.ticket_types as Record<string, unknown>[] | null) || [];
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) || "",
    category: row.category as EventCategory,
    date: row.date as string,
    time: (row.time as string) || "",
    endDate: row.end_date as string | undefined,
    endTime: row.end_time as string | undefined,
    venue: (row.venue as string) || "",
    city: (row.city as string) || "",
    image: (row.image as string) || "",
    gallery: (row.gallery as string[]) || [],
    organizerId: row.organizer_id as string,
    organizerName: (row.organizer_name as string) || "",
    organizerCategory: row.organizer_category as OrganizerCategory | undefined,
    organizerSubtype: row.organizer_subtype as string | undefined,
    ticketTypes: tts.map((tt) => ({
      id: tt.id as string,
      name: tt.name as string,
      description: (tt.description as string) || "",
      price: Number(tt.price),
      currency: "USD" as const,
      quantity: Number(tt.quantity),
      sold: Number(tt.sold),
      markup: Number(tt.markup) || 0,
    })),
    totalTickets: Number(row.total_tickets) || 0,
    soldTickets: Number(row.sold_tickets) || 0,
    status: row.status as Event["status"],
    platformMarkup: Number(row.platform_markup) || 0,
    promoVideo: row.promo_video as Event["promoVideo"],
    platformNegotiated: row.platform_negotiated as Event["platformNegotiated"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function eventToDbRow(event: Event) {
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    date: event.date,
    time: event.time,
    end_date: event.endDate || null,
    end_time: event.endTime || null,
    venue: event.venue,
    city: event.city,
    image: event.image,
    gallery: event.gallery || [],
    organizer_id: event.organizerId,
    organizer_name: event.organizerName,
    organizer_category: event.organizerCategory || null,
    organizer_subtype: event.organizerSubtype || null,
    status: event.status,
    platform_markup: event.platformMarkup || 0,
    promo_video: event.promoVideo || null,
    platform_negotiated: event.platformNegotiated || null,
  };
}

function ticketTypeToDbRow(tt: TicketType, eventId: string) {
  const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tt.id);
  return {
    ...(isRealUUID ? { id: tt.id } : {}),
    event_id: eventId,
    name: tt.name,
    description: tt.description || "",
    price: tt.price,
    currency: tt.currency,
    quantity: tt.quantity,
    sold: tt.sold,
    markup: tt.markup || 0,
  };
}

export async function getStoredEvents(limit = 50): Promise<Event[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("getStoredEvents:", error.message); return []; }
  return (data || []).map(dbToEvent);
}

export async function saveEvent(event: Event): Promise<string> {
  const supabase = createClient();
  const isNew = !event.id || event.id.startsWith("evt-");
  let eventId: string;

  if (isNew) {
    const { data, error } = await supabase
      .from("events")
      .insert(eventToDbRow(event))
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to create event");
    eventId = data.id;

    await supabase.from("ticket_types").insert(
      event.ticketTypes.map((tt) => ticketTypeToDbRow(tt, eventId))
    );
  } else {
    eventId = event.id;
    await supabase.from("events").update(eventToDbRow(event)).eq("id", eventId);

    // Upsert ticket types — preserve IDs so existing tickets aren't orphaned
    if (event.ticketTypes.length > 0) {
      await supabase.from("ticket_types").upsert(
        event.ticketTypes.map((tt) => ticketTypeToDbRow(tt, eventId)),
        { onConflict: "id" }
      );
    }
  }

  notifyChange();
  return eventId;
}

export async function deleteStoredEvent(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("events").delete().eq("id", id);
  notifyChange();
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("id", id)
    .single();
  return data ? dbToEvent(data) : undefined;
}

export async function getOrganizerEvents(organizerId: string, limit = 50): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(dbToEvent);
}

export async function getPublishedEvents(limit = 100): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(dbToEvent);
}

export async function getFeaturedEvents(count = 8): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("status", "published")
    .order("sold_tickets", { ascending: false })
    .limit(count);
  return (data || []).map(dbToEvent);
}

export async function getNewestEvents(count = 8): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(count);
  return (data || []).map(dbToEvent);
}

export async function getEventsByCategory(category: string, limit = 12): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("status", "published")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(dbToEvent);
}

export async function getUpcomingEvents(limit = 20): Promise<Event[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("status", "published")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(limit);
  return (data || []).map(dbToEvent);
}
