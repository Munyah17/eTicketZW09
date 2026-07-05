import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

// Only the columns the homepage display components actually read
const COLS = [
  "id", "title", "date", "time", "end_date", "end_time",
  "venue", "city", "image", "category", "status",
  "organizer_id", "organizer_name", "organizer_category",
  "sold_tickets", "total_tickets", "platform_markup",
  "platform_negotiated", "promo_video", "created_at", "updated_at",
  "ticket_types(id,name,price,currency,quantity,sold,markup)",
].join(",");

function toEvent(r: Record<string, unknown>): Event {
  const tts = (r.ticket_types as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    title: r.title as string,
    description: "",
    category: r.category as EventCategory,
    date: r.date as string,
    time: (r.time as string) ?? "",
    endDate: r.end_date as string | undefined,
    endTime: r.end_time as string | undefined,
    venue: (r.venue as string) ?? "",
    city: (r.city as string) ?? "",
    image: (r.image as string) ?? "",
    gallery: [],
    organizerId: r.organizer_id as string,
    organizerName: (r.organizer_name as string) ?? "",
    organizerCategory: r.organizer_category as OrganizerCategory | undefined,
    ticketTypes: tts.map((tt) => ({
      id: tt.id as string,
      name: tt.name as string,
      description: "",
      price: Number(tt.price),
      currency: "USD" as const,
      quantity: Number(tt.quantity),
      sold: Number(tt.sold),
      markup: Number(tt.markup) || 0,
    })),
    totalTickets: Number(r.total_tickets) || 0,
    soldTickets: Number(r.sold_tickets) || 0,
    status: r.status as Event["status"],
    platformMarkup: Number(r.platform_markup) || 0,
    platformNegotiated: r.platform_negotiated as Event["platformNegotiated"],
    promoVideo: r.promo_video as Event["promoVideo"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function GET() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Two parallel queries cover every section:
  // 1. "featured" — top sellers, may include older events, needs its own sort
  // 2. "recent 100" — newest published events, used to derive all other sections
  const [{ data: featuredRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from("events")
      .select(COLS)
      .eq("status", "published")
      .order("sold_tickets", { ascending: false })
      .limit(8),
    supabase
      .from("events")
      .select(COLS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const recent = (recentRows ?? []) as unknown as Record<string, unknown>[];

  const byCategory = (cat: string) =>
    recent.filter((e) => e.category === cat).slice(0, 12).map(toEvent);

  const featured = (featuredRows ?? []) as unknown as Record<string, unknown>[];

  return NextResponse.json({
    featured: featured.map(toEvent),
    newest: recent.slice(0, 12).map(toEvent),
    upcoming: recent
      .filter((e) => (e.date as string) >= today)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      .slice(0, 20)
      .map(toEvent),
    comedy: byCategory("comedy"),
    music: byCategory("music"),
    sports: byCategory("sports"),
    marathon: byCategory("marathon"),
    conference: byCategory("conference"),
    workshop: byCategory("workshop"),
    festival: byCategory("festival"),
    theater: byCategory("theater"),
    exhibition: byCategory("exhibition"),
    other: byCategory("other"),
  });
}
