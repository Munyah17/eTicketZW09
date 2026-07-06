import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MINIMUM_PAYOUT, PAYOUT_TRANSACTION_COST_PERCENTAGE } from "@/lib/types";
import { calculatePayoutTransactionCost } from "@/lib/pricing";

// The admin-configurable floor (Platform Configuration > Payouts) overrides
// the MINIMUM_PAYOUT constant when set; the constant remains the fallback.
async function getMinPayout(): Promise<number> {
  const { data } = await createAdminClient()
    .from("platform_config")
    .select("min_payout_amount")
    .eq("id", 1)
    .single();
  const min = Number(data?.min_payout_amount);
  return Number.isFinite(min) && min >= 0 ? min : MINIMUM_PAYOUT;
}

// Available balance = total ticket revenue across the organizer's own events,
// minus every payout request that isn't declined (pending/processing count
// against the balance immediately, approved has already been paid out).
async function computeBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  organizerId: string
) {
  const { data: events } = await supabase.from("events").select("id").eq("organizer_id", userId);
  const eventIds = (events ?? []).map((e) => e.id);

  const { data: ticketTypes } = eventIds.length
    ? await supabase.from("ticket_types").select("price, sold").in("event_id", eventIds)
    : { data: [] as { price: number; sold: number }[] };
  const totalRevenue = (ticketTypes ?? []).reduce((s, tt) => s + Number(tt.price) * Number(tt.sold), 0);

  const { data: existingPayouts } = await supabase
    .from("payout_requests")
    .select("amount, status")
    .eq("organizer_id", organizerId);
  const committed = (existingPayouts ?? [])
    .filter((p) => p.status !== "declined")
    .reduce((s, p) => s + Number(p.amount), 0);

  return Math.max(0, totalRevenue - committed);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabase.from("organizers").select("id, name").eq("user_id", user.id).single();
  if (!organizer) return NextResponse.json({ error: "No organizer profile found for this account" }, { status: 404 });

  const [availableBalance, { data: payouts }, minPayout] = await Promise.all([
    computeBalance(supabase, user.id, organizer.id),
    supabase.from("payout_requests").select("*").eq("organizer_id", organizer.id).order("requested_at", { ascending: false }),
    getMinPayout(),
  ]);

  return NextResponse.json({
    organizerId: organizer.id,
    organizerName: organizer.name,
    availableBalance,
    payouts: payouts ?? [],
    minPayout,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabase.from("organizers").select("id, name").eq("user_id", user.id).single();
  if (!organizer) return NextResponse.json({ error: "No organizer profile found for this account" }, { status: 404 });

  const body = await req.json();
  const amount = Number(body.amount);
  const { paymentMethod, paymentDetails } = body;

  const minPayout = await getMinPayout();
  if (!amount || amount < minPayout) {
    return NextResponse.json({ error: `Minimum payout is $${minPayout}` }, { status: 400 });
  }
  if (!paymentMethod || !paymentDetails) {
    return NextResponse.json({ error: "Payment method and details are required" }, { status: 400 });
  }

  const availableBalance = await computeBalance(supabase, user.id, organizer.id);
  if (amount > availableBalance) {
    return NextResponse.json({ error: "Amount exceeds your available balance" }, { status: 400 });
  }

  const transactionCost = calculatePayoutTransactionCost(amount, PAYOUT_TRANSACTION_COST_PERCENTAGE);

  const { error } = await supabase.from("payout_requests").insert({
    organizer_id: organizer.id,
    organizer_name: organizer.name,
    amount,
    currency: "USD",
    status: "pending",
    payment_method: paymentMethod,
    payment_details: paymentDetails,
    transaction_cost: transactionCost,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
