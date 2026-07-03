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

  return NextResponse.json({ tickets });
}
