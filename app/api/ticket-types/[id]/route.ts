import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/server-audit-log";

// Restocking a sold-out (or nearly sold-out) ticket type. Reachable by
// Super Admin, Admin, or the organizer who owns the event -- RLS on
// ticket_types ("Organizer manages own tt") already encodes exactly that
// boundary, so this is the real enforcement; the explicit check below just
// gives a clearer error than a bare RLS-denied response would.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: "quantity must be a non-negative number" }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("ticket_types")
    .select("id, quantity, sold, name, event_id")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "Ticket type not found, or you don't have permission to edit it" }, { status: 404 });
  }

  // Can't set capacity below what's already sold — that would make
  // "available" go negative and doesn't correspond to any real action
  // (shrinking capacity below sold isn't a restock, it's a different,
  // unsupported operation).
  if (quantity < current.sold) {
    return NextResponse.json(
      { error: `Can't set quantity below ${current.sold} already sold. Enter ${current.sold} or higher.` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("ticket_types")
    .update({ quantity })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "ticket_type.restock",
    resourceType: "ticket_type",
    resourceId: id,
    details: { name: current.name, eventId: current.event_id, previousQuantity: current.quantity, newQuantity: quantity },
  });

  return NextResponse.json({ ticketType: updated });
}
