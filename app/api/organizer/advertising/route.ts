import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Organizers can't write to the banners table directly (RLS there is admin
// only) — this route is the trusted boundary: it verifies the caller is a
// real organizer via the session client, then uses the admin client to claim
// an available slot on their behalf. The claimed slot goes to "pending" for
// an admin to review and activate in Banner Management, it never flips
// straight to "active" from a self-service organizer request.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("banners")
    .select("id, type, position, price_per_day, status")
    .eq("status", "available")
    .order("type", { ascending: true })
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ availableSlots: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
  if (!organizer) return NextResponse.json({ error: "No organizer profile found for this account" }, { status: 404 });

  const body = await req.json();
  const { eventId, eventTitle, bannerType, startDate, endDate } = body;
  if (!eventId || !eventTitle || !bannerType || !startDate || !endDate) {
    return NextResponse.json({ error: "eventId, eventTitle, bannerType, startDate, and endDate are required" }, { status: 400 });
  }
  if (bannerType !== "hero" && bannerType !== "section") {
    return NextResponse.json({ error: "bannerType must be 'hero' or 'section'" }, { status: 400 });
  }

  // Confirm the event actually belongs to this organizer before promoting it.
  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).eq("organizer_id", user.id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: slot } = await admin
    .from("banners")
    .select("id, price_per_day")
    .eq("type", bannerType)
    .eq("status", "available")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!slot) {
    return NextResponse.json({ error: `No ${bannerType} slots are currently available` }, { status: 409 });
  }

  const { error } = await admin
    .from("banners")
    .update({
      organizer_id: organizer.id,
      title: eventTitle,
      link: `/events/${eventId}`,
      start_date: startDate,
      end_date: endDate,
      status: "pending",
    })
    .eq("id", slot.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, pricePerDay: slot.price_per_day });
}
