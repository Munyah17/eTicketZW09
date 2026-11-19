import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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
  "show_ticket_counts", "allow_split_payment", "split_deposit_percent", "split_installment_count",
  "created_at", "updated_at",
  "ticket_types(id,name,description,price,currency,quantity,sold,markup,custom_charge_fixed,custom_charge_percent,custom_markup_fixed,custom_markup_percent)",
  "event_add_ons(id,name,description,price,quantity,sold,position)",
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
    showTicketCounts: !!r.show_ticket_counts,
    allowSplitPayment: !!r.allow_split_payment,
    splitDepositPercent: Number(r.split_deposit_percent) || 30,
    splitInstallmentCount: Number(r.split_installment_count) || 2,
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
  // Per-class custom charge/markup — Super Admin only.
  customChargeFixed?: number;
  customChargePercent?: number;
  customMarkupFixed?: number;
  customMarkupPercent?: number;
}

interface AddOnEdit {
  id?: string; // present = update existing; absent = insert new
  name: string;
  description?: string;
  price: number;
  quantity?: number | null; // null = unlimited
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
    addOns?: AddOnEdit[];
    showTicketCounts?: boolean;
    allowSplitPayment?: boolean;
    splitDepositPercent?: number;
    splitInstallmentCount?: number;
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
  if (body.showTicketCounts !== undefined) updates.show_ticket_counts = !!body.showTicketCounts;
  if (body.allowSplitPayment !== undefined) updates.allow_split_payment = !!body.allowSplitPayment;
  if (body.splitDepositPercent !== undefined) {
    updates.split_deposit_percent = Math.min(90, Math.max(10, Number(body.splitDepositPercent) || 30));
  }
  if (body.splitInstallmentCount !== undefined) {
    updates.split_installment_count = Math.max(1, Math.floor(Number(body.splitInstallmentCount) || 2));
  }

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
          .update({
            name: tt.name,
            description: tt.description || "",
            price: tt.price,
            quantity: tt.quantity,
            custom_charge_fixed: Number(tt.customChargeFixed) || 0,
            custom_charge_percent: Number(tt.customChargePercent) || 0,
            custom_markup_fixed: Number(tt.customMarkupFixed) || 0,
            custom_markup_percent: Number(tt.customMarkupPercent) || 0,
          })
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
          custom_charge_fixed: Number(tt.customChargeFixed) || 0,
          custom_charge_percent: Number(tt.customChargePercent) || 0,
          custom_markup_fixed: Number(tt.customMarkupFixed) || 0,
          custom_markup_percent: Number(tt.customMarkupPercent) || 0,
        });
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }
  }

  // Add-ons: upsert the ones sent, delete any that were removed. `sold` is
  // trigger/fulfillment-owned and never written from here.
  if (body.addOns) {
    const keepIds = new Set(body.addOns.filter((a) => a.id).map((a) => a.id as string));
    const { data: existingAddOns } = await supabase
      .from("event_add_ons")
      .select("id")
      .eq("event_id", id);
    const existingIds = new Set(((existingAddOns ?? []) as { id: string }[]).map((a) => a.id));
    const toDelete = [...existingIds].filter((aid) => !keepIds.has(aid));
    if (toDelete.length > 0) {
      await supabase.from("event_add_ons").delete().in("id", toDelete);
    }
    for (let i = 0; i < body.addOns.length; i++) {
      const a = body.addOns[i];
      if (!a.name || Number(a.price) < 0) {
        return NextResponse.json({ error: "Each add-on needs a name and a non-negative price" }, { status: 400 });
      }
      const row = {
        event_id: id,
        name: a.name,
        description: a.description || "",
        price: Number(a.price),
        quantity: a.quantity === undefined ? null : a.quantity,
        position: i,
      };
      if (a.id && existingIds.has(a.id)) {
        const { error: aErr } = await supabase.from("event_add_ons").update(row).eq("id", a.id);
        if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
      } else {
        const { error: aErr } = await supabase.from("event_add_ons").insert(row);
        if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
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

  revalidateTag("events", "max");
  return NextResponse.json({ success: true });
}
