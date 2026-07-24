import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

// Full event editing — Super Admin only (not regular Admin), so a Super
// Admin can step in and fix/help a client-organizer's listing directly
// (wrong date, typo in the venue, a ticket type that needs correcting)
// instead of walking them through it. Organizers editing their own events
// is a separate, not-yet-built feature; this route is deliberately scoped
// to the "assist a client" use case that was actually requested.
const COLS = [
  "id", "title", "description", "date", "time", "end_date", "end_time",
  "venue", "city", "category", "status",
  "organizer_id", "organizer_name", "organizer_category", "organizer_subtype",
  "sold_tickets", "total_tickets", "platform_markup", "image",
  "created_at", "updated_at",
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
    gallery: [],
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
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("events").select(COLS).eq("id", id).single();

  if (error || !data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event: toEvent(data as unknown as Record<string, unknown>) });
}

interface TicketTypeEdit {
  id?: string; // present = update existing row; absent = insert new
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  let body: {
    title?: string; description?: string; category?: string;
    date?: string; time?: string; endDate?: string | null; endTime?: string | null;
    venue?: string; city?: string; ticketTypes?: TicketTypeEdit[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("events")
    .select("id, title, organizer_id, ticket_types(id, sold)")
    .eq("id", id)
    .single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.date !== undefined) updates.date = body.date;
  if (body.time !== undefined) updates.time = body.time;
  if (body.endDate !== undefined) updates.end_date = body.endDate;
  if (body.endTime !== undefined) updates.end_time = body.endTime;
  if (body.venue !== undefined) updates.venue = body.venue;
  if (body.city !== undefined) updates.city = body.city;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase.from("events").update(updates).eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (body.ticketTypes) {
    const soldById = new Map(
      ((existing.ticket_types as { id: string; sold: number }[]) ?? []).map((tt) => [tt.id, tt.sold])
    );
    for (const tt of body.ticketTypes) {
      if (!tt.name || tt.price < 0 || tt.quantity < 0) {
        return NextResponse.json({ error: "Each ticket type needs a name, and price/quantity ≥ 0" }, { status: 400 });
      }
      if (tt.id) {
        const sold = soldById.get(tt.id) ?? 0;
        if (tt.quantity < sold) {
          return NextResponse.json(
            { error: `"${tt.name}": can't set quantity below ${sold} already sold` },
            { status: 400 }
          );
        }
        const { error: ttError } = await supabase
          .from("ticket_types")
          .update({ name: tt.name, description: tt.description || "", price: tt.price, quantity: tt.quantity })
          .eq("id", tt.id);
        if (ttError) {
          return NextResponse.json({ error: ttError.message }, { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase.from("ticket_types").insert({
          event_id: id,
          name: tt.name,
          description: tt.description || "",
          price: tt.price,
          quantity: tt.quantity,
          currency: "USD",
        });
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }
  }

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "event.edit",
    resourceType: "event",
    resourceId: id,
    details: { title: body.title ?? existing.title, organizerId: existing.organizer_id, fields: Object.keys(updates) },
  });

  return NextResponse.json({ success: true });
}
