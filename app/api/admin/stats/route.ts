import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/types";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();

  // All queries run in parallel — counts and lists need no sequential dependency
  const [
    { count: totalEvents },
    { count: organizerCount },
    { count: totalUsers },
    { count: customerCount },
    { count: pendingPayouts },
    { data: pubData },
    { data: recentEvents },
    { data: recentOrganizers },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "organizer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("payout_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    // Fetch only the two columns needed to compute totals — no ticket_types here
    supabase.from("events").select("id, sold_tickets").eq("status", "published"),
    supabase
      .from("events")
      .select("id, title, organizer_name, date, status, sold_tickets, total_tickets, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("profiles")
      .select("id, name, email, verified")
      .eq("role", "organizer")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("profiles")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const publishedIds = (pubData ?? []).map((e) => e.id as string);
  const publishedEvents = publishedIds.length;
  const totalTicketsSold = (pubData ?? []).reduce((s, e) => s + Number(e.sold_tickets), 0);

  // Revenue requires price × sold per ticket type — one follow-up query, server-side sum
  let grossRevenue = 0;
  if (publishedIds.length > 0) {
    const { data: ttRows } = await supabase
      .from("ticket_types")
      .select("price, sold")
      .in("event_id", publishedIds);
    grossRevenue = (ttRows ?? []).reduce((s, tt) => s + Number(tt.price) * Number(tt.sold), 0);
  }

  const platformFees = grossRevenue * (PLATFORM_FEE_PERCENTAGE / 100);

  return NextResponse.json({
    totalEvents: totalEvents ?? 0,
    publishedEvents,
    totalTicketsSold,
    grossRevenue,
    platformFees,
    organizerCount: organizerCount ?? 0,
    recentEvents: recentEvents ?? [],
    recentOrganizers: recentOrganizers ?? [],
  });
}
