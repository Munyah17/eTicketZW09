import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";
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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

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
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

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

// Deletes a listing outright — for junk/test/duplicate events with no real
// transaction history. Reachable by both Admin and Super Admin (same bar as
// the rest of this route). An event that has ever sold anything is refused:
// buyers hold tickets referencing it, and the events/ticket_types/tickets
// foreign keys have no ON DELETE CASCADE by design, so this would either
// orphan those records or fail outright. Use "Cancel" (PATCH status) for
// those instead — it stops further sales while preserving the audit trail.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { eventId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { eventId } = body;
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: event } = await supabase.from("events").select("title").eq("id", eventId).single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const [{ count: ticketCount }, { count: paidPaymentCount }, { count: gateSaleCount }] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "paid"),
    supabase.from("gate_sales").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);

  if ((ticketCount ?? 0) > 0 || (paidPaymentCount ?? 0) > 0 || (gateSaleCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `"${event.title}" has ${ticketCount ?? 0} ticket(s) sold — deleting would destroy buyers' records. Use Cancel instead, which stops sales but keeps the history.`,
      },
      { status: 409 }
    );
  }

  // Nothing was ever sold — safe to clean up. Abandoned/failed checkout
  // attempts and unsold ticket types have to go first to satisfy the FK
  // constraints on events before the event row itself can be deleted.
  const { error: paymentsError } = await supabase.from("payments").delete().eq("event_id", eventId);
  if (paymentsError) {
    console.error("Admin event delete (payments) error:", paymentsError.message);
    return NextResponse.json({ error: "Failed to delete event's payment records" }, { status: 500 });
  }

  const { error: ttError } = await supabase.from("ticket_types").delete().eq("event_id", eventId);
  if (ttError) {
    console.error("Admin event delete (ticket_types) error:", ttError.message);
    return NextResponse.json({ error: "Failed to delete event's ticket types" }, { status: 500 });
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    console.error("Admin event delete error:", error.message);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "event.delete",
    resourceType: "event",
    resourceId: eventId,
    details: { title: event.title },
  });

  return NextResponse.json({ success: true });
}
