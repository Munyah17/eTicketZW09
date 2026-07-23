import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";

// The System Wallet — Super Admin only, per spec (not even regular Admin).
// Separates the platform's actual *earnings* (buyer service fees +
// organizer commissions, from wallet_ledger) from total money *processed*
// (the full amount buyers paid, from payments) — the two numbers answer
// different questions and shouldn't be conflated.
export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();

  const [{ data: ledgerRows, error: ledgerError }, { data: paidPayments, error: paymentsError }] = await Promise.all([
    admin.from("wallet_ledger").select("buyer_fee_amount, commission_amount, currency, created_at, event_id, organizer_id"),
    admin.from("payments").select("amount, currency").eq("status", "paid"),
  ]);

  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

  const rows = ledgerRows ?? [];
  const totalBuyerFees = rows.reduce((sum, r) => sum + Number(r.buyer_fee_amount), 0);
  const totalCommissions = rows.reduce((sum, r) => sum + Number(r.commission_amount), 0);
  const totalEarnings = totalBuyerFees + totalCommissions;
  const totalMoneyProcessed = (paidPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  // Last 30 days, day-by-day, for a simple trend view.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, { buyerFees: number; commissions: number }>();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t < thirtyDaysAgo) continue;
    const day = (r.created_at as string).slice(0, 10);
    const existing = byDay.get(day) ?? { buyerFees: 0, commissions: 0 };
    existing.buyerFees += Number(r.buyer_fee_amount);
    existing.commissions += Number(r.commission_amount);
    byDay.set(day, existing);
  }
  const trend = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v, total: v.buyerFees + v.commissions }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalBuyerFees,
    totalCommissions,
    totalEarnings,
    totalMoneyProcessed,
    ticketsCounted: rows.length,
    trend,
  });
}
