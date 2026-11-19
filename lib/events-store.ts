import { createClient } from "@/lib/supabase/client";
import { Event, EventCategory, OrganizerCategory, TicketType, EventCustomField, EventAddOn } from "./types";

// Notify same-tab listeners (Realtime handles cross-tab)
function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eticket:events-updated"));
  }
}

function dbToEvent(row: Record<string, unknown>): Event {
  const tts = (row.ticket_types as Record<string, unknown>[] | null) || [];
  const fields = (row.event_custom_fields as Record<string, unknown>[] | null) || [];
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
      customChargeFixed: Number(tt.custom_charge_fixed) || 0,
      customChargePercent: Number(tt.custom_charge_percent) || 0,
      customMarkupFixed: Number(tt.custom_markup_fixed) || 0,
      customMarkupPercent: Number(tt.custom_markup_percent) || 0,
    })),
    addOns: ((row.event_add_ons as Record<string, unknown>[] | null) || [])
      .map((a) => ({
        id: a.id as string,
        name: a.name as string,
        description: (a.description as string) || "",
        price: Number(a.price),
        quantity: a.quantity == null ? null : Number(a.quantity),
        sold: Number(a.sold) || 0,
        position: Number(a.position) || 0,
      }))
      .sort((a, b) => a.position - b.position),
    customFields: fields
      .map((f) => ({
        id: f.id as string,
        label: f.label as string,
        fieldType: f.field_type as EventCustomField["fieldType"],
        options: (f.options as string[] | null) ?? undefined,
        required: !!f.required,
        position: Number(f.position) || 0,
      }))
      .sort((a, b) => a.position - b.position),
    totalTickets: Number(row.total_tickets) || 0,
    soldTickets: Number(row.sold_tickets) || 0,
    status: row.status as Event["status"],
    platformMarkup: Number(row.platform_markup) || 0,
    showTicketCounts: !!row.show_ticket_counts,
    allowSplitPayment: !!row.allow_split_payment,
    splitDepositPercent: Number(row.split_deposit_percent) || 30,
    splitInstallmentCount: Number(row.split_installment_count) || 2,
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
    total_tickets: event.totalTickets,
    status: event.status,
    platform_markup: event.platformMarkup || 0,
    show_ticket_counts: !!event.showTicketCounts,
    allow_split_payment: !!event.allowSplitPayment,
    split_deposit_percent: event.splitDepositPercent ?? 30,
    split_installment_count: event.splitInstallmentCount ?? 2,
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
    // `sold` is deliberately NOT written here — it's owned by the
    // update_sold_counts trigger and must never be set from the client, or an
    // organizer could forge sell-through / sold-out state. New rows default
    // to 0; updates leave the trigger-maintained value untouched.
    markup: tt.markup || 0,
    // Per-class custom charge/markup — admin/super-admin only; organizers
    // leave these at 0 and the server ignores client-supplied values.
    custom_charge_fixed: tt.customChargeFixed || 0,
    custom_charge_percent: tt.customChargePercent || 0,
    custom_markup_fixed: tt.customMarkupFixed || 0,
    custom_markup_percent: tt.customMarkupPercent || 0,
  };
}

function customFieldToDbRow(f: EventCustomField, eventId: string) {
  return {
    event_id: eventId,
    label: f.label,
    field_type: f.fieldType,
    options: f.options && f.options.length > 0 ? f.options : null,
    required: f.required,
    position: f.position,
  };
}

function addOnToDbRow(a: EventAddOn, eventId: string, position: number) {
  const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id);
  return {
    ...(isRealUUID ? { id: a.id } : {}),
    event_id: eventId,
    name: a.name,
    description: a.description || "",
    price: a.price,
    quantity: a.quantity ?? null,
    position,
    // `sold` is fulfillment-owned — never written from the client.
  };
}

export async function getStoredEvents(limit = 50): Promise<Event[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_custom_fields(*), event_add_ons(*)")
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

    if (event.customFields && event.customFields.length > 0) {
      await supabase.from("event_custom_fields").insert(
        event.customFields.map((f) => customFieldToDbRow(f, eventId))
      );
    }

    if (event.addOns && event.addOns.length > 0) {
      await supabase.from("event_add_ons").insert(
        event.addOns.map((a, i) => addOnToDbRow(a, eventId, i))
      );
    }
  } else {
    eventId = event.id;
    await supabase.from("events").update(eventToDbRow(event)).eq("id", eventId);

    // Ticket types: upsert the ones with a real UUID (preserves ids so existing
    // tickets aren't orphaned), insert brand-new ones separately. A single
    // mixed upsert is fragile — rows without an id rely on column defaults and
    // PostgREST is picky about heterogeneous payloads. Removed types are never
    // deleted here: a type with sales must not vanish (the organizer edit UI
    // also doesn't offer removal of existing types).
    const tts = event.ticketTypes || [];
    const ttRows = tts.map((tt) => ticketTypeToDbRow(tt, eventId));
    const ttUpsert = ttRows.filter((r) => r.id);
    const ttInsert = ttRows.filter((r) => !r.id);
    if (ttUpsert.length > 0) {
      await supabase.from("ticket_types").upsert(ttUpsert, { onConflict: "id" });
    }
    if (ttInsert.length > 0) {
      await supabase.from("ticket_types").insert(ttInsert);
    }

    // Sync add-ons: upsert the ones kept, delete any removed. Only real UUID
    // ids are upserted — client-side keys for brand-new add-ons are ignored so
    // the DB assigns the id.
    const addOns = event.addOns || [];
    const { data: existingAddOns } = await supabase
      .from("event_add_ons")
      .select("id")
      .eq("event_id", eventId);
    const existingIds = new Set(((existingAddOns ?? []) as { id: string }[]).map((a) => a.id));
    const keepIds = new Set(addOns.filter((a) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id)).map((a) => a.id));
    const toDelete = [...existingIds].filter((aid) => !keepIds.has(aid));
    if (toDelete.length > 0) {
      await supabase.from("event_add_ons").delete().in("id", toDelete);
    }
    const upsertRows = addOns.map((a, i) => addOnToDbRow(a, eventId, i)).filter((r) => r.id);
    if (upsertRows.length > 0) {
      await supabase.from("event_add_ons").upsert(upsertRows, { onConflict: "id" });
    }
    const insertRows = addOns.map((a, i) => addOnToDbRow(a, eventId, i)).filter((r) => !r.id);
    if (insertRows.length > 0) {
      await supabase.from("event_add_ons").insert(insertRows);
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
    .select("*, ticket_types(*), event_custom_fields(*), event_add_ons(*)")
    .eq("id", id)
    .single();
  return data ? dbToEvent(data) : undefined;
}

export async function getOrganizerEvents(organizerId: string, limit = 50): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_add_ons(*)")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(dbToEvent);
}

export async function getPublishedEvents(limit = 100): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_add_ons(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(dbToEvent);
}

export async function getFeaturedEvents(count = 8): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_add_ons(*)")
    .eq("status", "published")
    .order("sold_tickets", { ascending: false })
    .limit(count);
  return (data || []).map(dbToEvent);
}

export async function getNewestEvents(count = 8): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_add_ons(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(count);
  return (data || []).map(dbToEvent);
}

export async function getEventsByCategory(category: string, limit = 12): Promise<Event[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_add_ons(*)")
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
    .select("*, ticket_types(*), event_add_ons(*)")
    .eq("status", "published")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(limit);
  return (data || []).map(dbToEvent);
}
