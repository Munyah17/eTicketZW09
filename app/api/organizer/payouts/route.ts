import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MINIMUM_PAYOUT, PAYOUT_TRANSACTION_COST_PERCENTAGE } from "@/lib/types";
import { calculatePayoutTransactionCost } from "@/lib/pricing";
import { sendPayoutSubmittedEmail } from "@/lib/email/send-payout-notification";

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

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user is super admin for technical support access
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isSuperAdmin = profile?.role === "super_admin";

  // Super admin can view any organizer's payouts via ?organizerId=xxx query param
  const url = new URL(req.url);
  const queryOrganizerId = url.searchParams.get("organizerId");

  let organizerId: string;
  let organizerName: string;

  if (isSuperAdmin && queryOrganizerId) {
    // Super admin viewing specific organizer's data
    const { data: organizer } = await supabase.from("organizers").select("id, name").eq("id", queryOrganizerId).single();
    if (!organizer) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
    organizerId = organizer.id;
    organizerName = organizer.name;
  } else {
    // Regular organizer viewing their own data
    const { data: organizer } = await supabase.from("organizers").select("id, name").eq("user_id", user.id).single();
    if (!organizer) return NextResponse.json({ error: "No organizer profile found for this account" }, { status: 404 });
    organizerId = organizer.id;
    organizerName = organizer.name;
  }

  const [availableBalance, { data: payouts }, minPayout] = await Promise.all([
    computeBalance(supabase, user.id, organizerId),
    supabase.from("payout_requests").select("*").eq("organizer_id", organizerId).order("requested_at", { ascending: false }),
    getMinPayout(),
  ]);

  return NextResponse.json({
    organizerId,
    organizerName,
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

  const { data: inserted, error } = await supabase
    .from("payout_requests")
    .insert({
      organizer_id: organizer.id,
      organizer_name: organizer.name,
      amount,
      currency: "USD",
      status: "pending",
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      transaction_cost: transactionCost,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (inserted) {
    after(() =>
      sendPayoutSubmittedEmail({
        id: inserted.id,
        organizerId: organizer.id,
        organizerName: organizer.name,
        amount,
        paymentMethod,
      }).catch(() => {})
    );
  }

  return NextResponse.json({ success: true });
}
