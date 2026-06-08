import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventCategory, OrganizerCategory } from "@/lib/types";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("events")
    .select("*, ticket_types(*)")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event: toEvent(data as Record<string, unknown>) });
}
