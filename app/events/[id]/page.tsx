import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EventDetailClient } from "./event-detail-client";
import type { Event, EventCategory, OrganizerCategory, EventCustomField } from "@/lib/types";

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
      customChargeFixed: Number(tt.custom_charge_fixed) || 0,
      customChargePercent: Number(tt.custom_charge_percent) || 0,
      customMarkupFixed: Number(tt.custom_markup_fixed) || 0,
      customMarkupPercent: Number(tt.custom_markup_percent) || 0,
    })),
    addOns: ((r.event_add_ons as Record<string, unknown>[] | null) ?? [])
      .map((a) => ({
        id: a.id as string,
        name: a.name as string,
        description: (a.description as string) || "",
        price: Number(a.price),
        quantity: a.quantity == null ? null : Number(a.quantity),
        sold: Number(a.sold) || 0,
        position: Number(a.position) || 0,
      }))
      .sort((a, b) => a.position - b.position),
    customFields: ((r.event_custom_fields as Record<string, unknown>[] | null) ?? [])
      .map((f) => ({
        id: f.id as string,
        label: f.label as string,
        fieldType: f.field_type as EventCustomField["fieldType"],
        options: (f.options as string[] | null) ?? undefined,
        required: !!f.required,
        position: Number(f.position) || 0,
      }))
      .sort((a, b) => a.position - b.position),
    totalTickets: Number(r.total_tickets) || 0,
    soldTickets: Number(r.sold_tickets) || 0,
    status: r.status as Event["status"],
    platformMarkup: Number(r.platform_markup) || 0,
    showTicketCounts: !!r.show_ticket_counts,
    allowSplitPayment: !!r.allow_split_payment,
    splitDepositPercent: Number(r.split_deposit_percent) || 30,
    splitInstallmentCount: Number(r.split_installment_count) || 2,
    platformNegotiated: r.platform_negotiated as Event["platformNegotiated"],
    promoVideo: r.promo_video as Event["promoVideo"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const getEvent = cache(async (id: string) => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, ticket_types(*), event_custom_fields(*), event_add_ons(*)")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error || !data) return null;
  return toEvent(data as Record<string, unknown>);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return {};

  const formattedDate = new Date(event.date).toLocaleDateString("en-ZW", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const description = `${formattedDate} at ${event.venue}, ${event.city}. Book your tickets on E-TicketsZW.`;

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      ...(event.image ? { images: [{ url: event.image, width: 1200, height: 630, alt: event.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      ...(event.image ? { images: [event.image] } : {}),
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <EventDetailClient event={event} />
      <Footer />
    </div>
  );
}
