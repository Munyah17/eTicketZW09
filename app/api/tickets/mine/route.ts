import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tickets")
    .select("*")
    .eq("buyer_user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error) {
    console.error("My tickets fetch error:", error.message);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }

  const tickets = (data ?? []).map((t) => ({
    id: t.id,
    eventId: t.event_id,
    eventTitle: t.event_title,
    eventDate: t.event_date,
    eventTime: t.event_time,
    venue: t.venue,
    ticketTypeName: t.ticket_type_name,
    buyerName: t.buyer_name,
    buyerDisplayName: t.buyer_display_name,
    totalPaid: Number(t.total_paid),
    currency: t.currency,
    paymentMethod: t.payment_method,
    validated: t.validated,
    purchasedAt: t.purchased_at,
  }));

  // Bank-transfer orders awaiting manual verification have no ticket row
  // yet — but the buyer still needs to see them on their dashboard,
  // including whether we've asked for more information.
  const { data: heldPayments } = await admin
    .from("payments")
    .select("reference, amount, currency, status, metadata, review_status, review_reason, created_at")
    .eq("user_id", user.id)
    .eq("provider", "bank_transfer")
    .in("status", ["on_hold", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  const heldOrders = (heldPayments ?? []).map((p) => {
    const m = (p.metadata ?? {}) as Record<string, unknown>;
    return {
      reference: p.reference,
      status: p.status,
      reviewStatus: p.review_status,
      reviewReason: p.review_reason,
      amount: Number(p.amount),
      currency: p.currency,
      eventTitle: (m.eventTitle as string) || "",
      eventDate: (m.eventDate as string) || "",
      eventTime: (m.eventTime as string) || "",
      venue: (m.venue as string) || "",
      ticketTypeName: (m.ticketTypeName as string) || "",
      quantity: (m.quantity as number) || 1,
      transactionReference: (m.transaction_reference as string) || "",
      submittedAt: p.created_at,
    };
  });

  return NextResponse.json({ tickets, heldOrders });
}
