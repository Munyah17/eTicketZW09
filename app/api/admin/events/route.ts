import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

const COLS = [
  "id", "title", "description", "date", "time",
  "venue", "city", "category", "status",
  "organizer_id", "organizer_name", "organizer_category",
  "sold_tickets", "total_tickets", "platform_markup",
  "created_at", "updated_at",
  "ticket_types(id,name,price,currency,quantity,sold)",
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
    venue: (r.venue as string) ?? "",
    city: (r.city as string) ?? "",
    image: "",
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
      markup: 0,
    })),
    totalTickets: Number(r.total_tickets) || 0,
    soldTickets: Number(r.sold_tickets) || 0,
    status: r.status as Event["status"],
    platformMarkup: Number(r.platform_markup) || 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "super_admin" || profile?.role === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";

  const supabase = createAdminClient();
  let query: any = supabase.from("events").select(COLS).order("created_at", { ascending: false }).limit(500);

  if (search) {
    query = query.or(`title.ilike.%${search}%,organizer_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Admin events fetch error:", error.message);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  return NextResponse.json({ events: (data ?? []).map(toEvent) });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventId?: string; platformMarkup?: number | null; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { eventId, platformMarkup, status } = body;
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (platformMarkup !== undefined) updates.platform_markup = platformMarkup ?? 0;
  if (status !== undefined) {
    if (status !== "published" && status !== "cancelled") {
      return NextResponse.json({ error: "status must be 'published' or 'cancelled'" }, { status: 400 });
    }
    updates.status = status;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId);

  if (error) {
    console.error("Admin markup update error:", error.message);
    return NextResponse.json({ error: "Failed to update markup" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
