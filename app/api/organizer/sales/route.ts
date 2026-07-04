import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared by the organizer Analytics and Sales pages — both just need the
// organizer's own events (with ticket_types for pricing) and tickets sold
// against them. Events are owned directly by the profile (organizer_id
// -> profiles.id), so no join through the separate organizers table needed.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, category, date, city, total_tickets, sold_tickets, ticket_types(price, sold)")
    .eq("organizer_id", user.id);

  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: tickets, error: ticketsError } = eventIds.length
    ? await supabase.from("tickets").select("*").in("event_id", eventIds).order("purchased_at", { ascending: false })
    : { data: [], error: null };

  if (ticketsError) return NextResponse.json({ error: ticketsError.message }, { status: 500 });

  return NextResponse.json({ events: events ?? [], tickets: tickets ?? [] });
}
