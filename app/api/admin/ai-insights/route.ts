import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";
import { generateBusinessInsights } from "@/lib/groq";

interface EventRow {
  id: string;
  title: string;
  organizer_name: string;
  category: string;
  city: string;
  date: string;
  sold_tickets: number;
  total_tickets: number;
}

function isoWeekStart(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().split("T")[0];
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: eventRows },
    { data: profileRows },
    { data: recentTickets },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, organizer_name, category, city, date, sold_tickets, total_tickets")
      .eq("status", "published"),
    supabase.from("profiles").select("role, organizer_category, created_at").gte("created_at", sixMonthsAgo),
    supabase
      .from("tickets")
      .select("purchased_at, total_paid")
      .eq("payment_status", "completed")
      .gte("purchased_at", ninetyDaysAgo),
  ]);

  const events = (eventRows ?? []) as EventRow[];
  const eventIds = events.map((e) => e.id);

  const { data: ticketTypeRows } = eventIds.length
    ? await supabase.from("ticket_types").select("event_id, price, sold").in("event_id", eventIds)
    : { data: [] as { event_id: string; price: number; sold: number }[] };

  const revenueByEvent = new Map<string, number>();
  for (const tt of ticketTypeRows ?? []) {
    revenueByEvent.set(tt.event_id, (revenueByEvent.get(tt.event_id) ?? 0) + Number(tt.price) * Number(tt.sold));
  }

  const totalRevenue = [...revenueByEvent.values()].reduce((s, v) => s + v, 0);
  const totalTicketsSold = events.reduce((s, e) => s + Number(e.sold_tickets), 0);
  const avgTicketPrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;

  // Top selling events by revenue
  const topEvents = events
    .map((e) => ({
      title: e.title,
      organizer: e.organizer_name,
      category: e.category,
      city: e.city,
      soldTickets: e.sold_tickets,
      totalTickets: e.total_tickets,
      revenue: revenueByEvent.get(e.id) ?? 0,
      sellThrough: e.total_tickets > 0 ? (e.sold_tickets / e.total_tickets) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Category performance
  const categoryMap = new Map<string, { events: number; sold: number; revenue: number }>();
  for (const e of events) {
    const bucket = categoryMap.get(e.category) ?? { events: 0, sold: 0, revenue: 0 };
    bucket.events += 1;
    bucket.sold += Number(e.sold_tickets);
    bucket.revenue += revenueByEvent.get(e.id) ?? 0;
    categoryMap.set(e.category, bucket);
  }
  const categoryPerformance = [...categoryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // City / town performance
  const cityMap = new Map<string, { events: number; sold: number; revenue: number }>();
  for (const e of events) {
    const city = e.city || "Unknown";
    const bucket = cityMap.get(city) ?? { events: 0, sold: 0, revenue: 0 };
    bucket.events += 1;
    bucket.sold += Number(e.sold_tickets);
    bucket.revenue += revenueByEvent.get(e.id) ?? 0;
    cityMap.set(city, bucket);
  }
  const cityPerformance = [...cityMap.entries()]
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Weekly sales trend, last 12 weeks
  const weekMap = new Map<string, { revenue: number; tickets: number }>();
  for (const t of recentTickets ?? []) {
    const week = isoWeekStart(new Date(t.purchased_at as string));
    const bucket = weekMap.get(week) ?? { revenue: 0, tickets: 0 };
    bucket.revenue += Number(t.total_paid);
    bucket.tickets += 1;
    weekMap.set(week, bucket);
  }
  const salesTrend = [...weekMap.entries()]
    .map(([week, v]) => ({ week, ...v }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Organizer category demographics + monthly signup growth
  const profiles = profileRows ?? [];
  const organizerCategoryMap = new Map<string, number>();
  for (const p of profiles) {
    if (p.role === "organizer" && p.organizer_category) {
      organizerCategoryMap.set(p.organizer_category, (organizerCategoryMap.get(p.organizer_category) ?? 0) + 1);
    }
  }
  const organizerDemographics = [...organizerCategoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const monthlySignups = new Map<string, { customers: number; organizers: number }>();
  for (const p of profiles) {
    const month = (p.created_at as string).slice(0, 7);
    const bucket = monthlySignups.get(month) ?? { customers: 0, organizers: 0 };
    if (p.role === "customer") bucket.customers += 1;
    else if (p.role === "organizer") bucket.organizers += 1;
    monthlySignups.set(month, bucket);
  }
  const signupGrowth = [...monthlySignups.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const stats = {
    totalRevenue,
    totalTicketsSold,
    totalEvents: events.length,
    avgTicketPrice,
    topEvents,
    categoryPerformance,
    cityPerformance,
    salesTrend,
    organizerDemographics,
    signupGrowth,
  };

  const summaryForAI = `
Platform totals: $${totalRevenue.toFixed(2)} revenue, ${totalTicketsSold} tickets sold across ${events.length} published events. Average ticket price $${avgTicketPrice.toFixed(2)}.

Top 10 events by revenue:
${topEvents.map((e, i) => `${i + 1}. "${e.title}" (${e.organizer}, ${e.category}, ${e.city}) — $${e.revenue.toFixed(2)}, ${e.soldTickets}/${e.totalTickets} tickets (${e.sellThrough.toFixed(0)}% sold)`).join("\n")}

Category performance (revenue):
${categoryPerformance.map((c) => `${c.category}: $${c.revenue.toFixed(2)} from ${c.sold} tickets across ${c.events} events`).join("\n")}

City/town performance (revenue):
${cityPerformance.map((c) => `${c.city}: $${c.revenue.toFixed(2)} from ${c.sold} tickets across ${c.events} events`).join("\n")}

Weekly sales trend (last 12 weeks, revenue):
${salesTrend.map((w) => `${w.week}: $${w.revenue.toFixed(2)} (${w.tickets} tickets)`).join("\n") || "No completed sales in the last 90 days."}

Organizer demographics by category:
${organizerDemographics.map((d) => `${d.category}: ${d.count} organizers`).join("\n") || "No organizer category data."}

Monthly signups, last 6 months (customers / organizers):
${signupGrowth.map((s) => `${s.month}: ${s.customers} customers, ${s.organizers} organizers`).join("\n")}
`.trim();

  let aiNarrative: string | null = null;
  let aiError: string | null = null;
  try {
    aiNarrative = await generateBusinessInsights(summaryForAI);
    if (!aiNarrative) aiError = "Add GROQ_API_KEY to your environment to enable AI-generated insights (free at console.groq.com).";
  } catch (e) {
    aiError = e instanceof Error ? e.message : "Failed to generate AI insights.";
  }

  return NextResponse.json({ stats, aiNarrative, aiError });
}
