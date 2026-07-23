import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

// Only the columns the homepage display components actually read
const COLS = [
  "id", "title", "date", "time", "end_date", "end_time",
  "venue", "city", "image", "category", "status",
  "organizer_id", "organizer_name", "organizer_category",
  "sold_tickets", "total_tickets", "platform_markup", "sold_out_at",
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
    soldOutAt: r.sold_out_at as string | undefined,
    platformMarkup: Number(r.platform_markup) || 0,
    platformNegotiated: r.platform_negotiated as Event["platformNegotiated"],
    promoVideo: r.promo_video as Event["promoVideo"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const now = Date.now();
  const today = new Date(now).toISOString().split("T")[0];
  const comingSoonFrom = new Date(now + SIX_WEEKS_MS).toISOString().split("T")[0];
  const soldOutCutoff = new Date(now - SEVEN_DAYS_MS).toISOString();

  // Single query covers every section — "recent 100" newest published
  // events, from which Featured, Best Selling, Coming Soon, and every
  // category row are all derived in memory.
  const { data: recentRows, error } = await supabase
    .from("events")
    .select(COLS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  // A query error must not be swallowed into "zero events" — that reads to
  // every visitor as "this platform has nothing on it" instead of the
  // transient DB hiccup it actually is. Surface it as a real failure so the
  // frontend can retry instead of rendering a false "No Events Yet".
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recent = (recentRows ?? []) as unknown as Record<string, unknown>[];

  const byCategory = (cat: string) =>
    recent.filter((e) => e.category === cat).slice(0, 12).map(toEvent);

  // Featured: a composite score, not raw sold_tickets — the old sort let one
  // huge historical event dominate forever, and had no floor keeping past
  // (unbuyable) events out at all.
  //   - sell-through rate (0-100) is the dominant signal: a small event
  //     that's 90% sold is more "hot" than a big one sitting at 20%.
  //   - log-scaled raw volume still gives real scale credit, so a
  //     500-ticket show at 40% doesn't lose to a 5-ticket meetup at 100%.
  //   - a real featured image is a cheap, checkable proxy for "polished
  //     listing" — also nudges organizers to actually add one.
  //   - a decaying freshness boost gives new listings a fair, temporary
  //     shot at visibility instead of being permanently buried under
  //     long-established top performers.
  const featuredScore = (e: Record<string, unknown>) => {
    const total = Number(e.total_tickets) || 0;
    const sold = Number(e.sold_tickets) || 0;
    const sellThrough = total > 0 ? sold / total : 0;
    const daysSinceCreated = (now - new Date(e.created_at as string).getTime()) / (1000 * 60 * 60 * 24);
    const freshnessBoost = Math.max(0, 15 - daysSinceCreated * 1.5);
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

  // Best Selling: ranked by sell-through rate, not raw volume, so fast-moving
  // events surface even if smaller than Featured's top sellers. A sold-out
  // event stays in this row (with a Sold Out ribbon) for 7 days post-sellout.
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
    .map(toEvent);

  return NextResponse.json({
    featured: featured.map(toEvent),
    bestSelling,
    comingSoon: recent
      .filter((e) => (e.date as string) >= comingSoonFrom)
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
