import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

// Shared, cached data layer for public event/banner reads. Everything here
// is identical for every visitor, so it's wrapped in unstable_cache (60s,
// tag-invalidated on admin mutations) — repeat requests skip the Supabase
// round-trip entirely. Server-only: uses the admin client (env vars, no
// cookies), which is safe inside unstable_cache.

const HOME_COLS = [
  "id", "title", "date", "time", "end_date", "end_time",
  "venue", "city", "image", "category", "status",
  "organizer_id", "organizer_name", "organizer_category",
  "sold_tickets", "total_tickets", "platform_markup", "sold_out_at",
  "platform_negotiated", "promo_video", "created_at", "updated_at",
  "ticket_types(id,name,price,currency,quantity,sold,markup)",
].join(",");

const LIST_COLS = [
  "id", "title", "description", "date", "time", "end_date", "end_time",
  "venue", "city", "image", "gallery", "category", "status",
  "organizer_id", "organizer_name", "organizer_category", "organizer_subtype",
  "sold_tickets", "total_tickets", "platform_markup", "platform_negotiated",
  "promo_video", "created_at", "updated_at",
  "ticket_types(id,name,description,price,currency,quantity,sold,markup)",
].join(",");

type Row = Record<string, unknown>;

function toHomeEvent(r: Row): Event {
  const tts = (r.ticket_types as Row[] | null) ?? [];
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
    soldOutAt: r.sold_out_at as string | undefined,
    platformMarkup: Number(r.platform_markup) || 0,
    platformNegotiated: r.platform_negotiated as Event["platformNegotiated"],
    promoVideo: r.promo_video as Event["promoVideo"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toListEvent(r: Row): Event {
  const tts = (r.ticket_types as Row[] | null) ?? [];
  return {
    ...toHomeEvent(r),
    description: (r.description as string) || "",
    gallery: (r.gallery as string[]) || [],
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
  };
}

export type HomeSections = {
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

const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchHomeSections(): Promise<HomeSections> {
  const supabase = createAdminClient();
  const now = Date.now();
  const today = new Date(now).toISOString().split("T")[0];
  const comingSoonFrom = new Date(now + SIX_WEEKS_MS).toISOString().split("T")[0];
  const soldOutCutoff = new Date(now - SEVEN_DAYS_MS).toISOString();

  const { data: recentRows, error } = await supabase
    .from("events")
    .select(HOME_COLS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const recent = (recentRows ?? []) as unknown as Row[];

  const byCategory = (cat: string) =>
    recent.filter((e) => e.category === cat).slice(0, 12).map(toHomeEvent);

  // Featured: composite score — sell-through rate dominant, log-scaled
  // volume, image bonus, decaying freshness boost for new listings.
  const featuredScore = (e: Row) => {
    const total = Number(e.total_tickets) || 0;
    const sold = Number(e.sold_tickets) || 0;
    const sellThrough = total > 0 ? sold / total : 0;
    const daysSinceCreated = (now - new Date(e.created_at as string).getTime()) / (1000 * 60 * 60 * 24);
    const freshnessBoost = Math.max(0, 80 - daysSinceCreated * 4);
    const hasImage = !!(e.image as string);
    return sellThrough * 100 + Math.log10(sold + 1) * 8 + (hasImage ? 10 : 0) + freshnessBoost;
  };

  const featured = recent
    .filter((e) => {
      const onSale = (e.date as string) >= today;
      const soldOut = e.sold_out_at as string | null;
      const recentlySoldOut = !!soldOut && soldOut >= soldOutCutoff;
      return onSale || recentlySoldOut;
    })
    .sort((a, b) => featuredScore(b) - featuredScore(a))
    .slice(0, 8);

  const bestSelling = recent
    .filter((e) => {
      const total = Number(e.total_tickets) || 0;
      if (total <= 0) return false;
      const onSale = (e.date as string) >= today;
      const soldOut = e.sold_out_at as string | null;
      const recentlySoldOut = !!soldOut && soldOut >= soldOutCutoff;
      return onSale || recentlySoldOut;
    })
    .sort((a, b) => {
      const pctA = (Number(a.sold_tickets) || 0) / (Number(a.total_tickets) || 1);
      const pctB = (Number(b.sold_tickets) || 0) / (Number(b.total_tickets) || 1);
      return pctB - pctA || (Number(b.sold_tickets) || 0) - (Number(a.sold_tickets) || 0);
    })
    .slice(0, 12)
    .map(toHomeEvent);

  return {
    featured: featured.map(toHomeEvent),
    bestSelling,
    comingSoon: recent
      .filter((e) => (e.date as string) >= comingSoonFrom)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      .slice(0, 20)
      .map(toHomeEvent),
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
  };
}

export const getHomeSections = unstable_cache(
  fetchHomeSections,
  ["home-sections"],
  { revalidate: 60, tags: ["events"] }
);

export interface EventsQuery {
  search?: string;
  category?: string;
  city?: string;
  sort?: string;
}

async function fetchPublishedEvents({ search = "", category = "", city = "", sort = "date-asc" }: EventsQuery): Promise<Event[]> {
  const supabase = createAdminClient();
  let query: any = supabase.from("events").select(LIST_COLS).eq("status", "published");

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

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toListEvent);
}

// Args are part of the cache key, so each (search, category, city, sort)
// combination gets its own 60s cache entry.
export const getPublishedEvents = unstable_cache(
  fetchPublishedEvents,
  ["published-events"],
  { revalidate: 60, tags: ["events"] }
);

export interface BannerRow {
  id: string;
  type: string;
  position: number;
  image?: string;
  link?: string;
  title?: string;
  impressions: number;
}

async function fetchBanners(type: "hero" | "section"): Promise<BannerRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("banners")
    .select("id, type, position, image, link, title, impressions")
    .eq("type", type)
    .eq("status", "active")
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BannerRow[];
}

export const getBanners = unstable_cache(
  fetchBanners,
  ["banners"],
  { revalidate: 60, tags: ["banners"] }
);
