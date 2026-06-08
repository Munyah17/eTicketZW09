import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

const COLS = [
  "id", "title", "description", "date", "time", "end_date", "end_time",
  "venue", "city", "image", "gallery", "category", "status",
  "organizer_id", "organizer_name", "organizer_category", "organizer_subtype",
  "sold_tickets", "total_tickets", "platform_markup", "platform_negotiated",
  "promo_video", "created_at", "updated_at",
  "ticket_types(id,name,description,price,currency,quantity,sold,markup)",
].join(",");

function toEvent(r: Record<string, unknown>): Event {
  const tts = (r.ticket_types as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) || "",
    category: r.category as EventCategory,
    date: r.date as string,
    time: (r.time as string) ?? "",
    endDate: r.end_date as string | undefined,
    endTime: r.end_time as string | undefined,
    venue: (r.venue as string) ?? "",
    city: (r.city as string) ?? "",
    image: (r.image as string) ?? "",
    gallery: (r.gallery as string[]) || [],
    organizerId: r.organizer_id as string,
    organizerName: (r.organizer_name as string) ?? "",
    organizerCategory: r.organizer_category as OrganizerCategory | undefined,
    organizerSubtype: r.organizer_subtype as string | undefined,
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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const city = searchParams.get("city") || "";
  const sort = searchParams.get("sort") || "date-asc";

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("events").select(COLS).eq("status", "published");

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,venue.ilike.%${search}%,organizer_name.ilike.%${search}%`
    );
  }
  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (city && city !== "All Cities") {
    query = query.eq("city", city);
  }

  switch (sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "date-desc":
      query = query.order("date", { ascending: false });
      break;
    case "popularity":
      query = query.order("sold_tickets", { ascending: false });
      break;
    default:
      query = query.order("date", { ascending: true });
  }

  const { data, error } = await query.limit(200);
  if (error) {
    console.error("Events list error:", error.message);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  return NextResponse.json({ events: (data ?? []).map(toEvent) });
}
