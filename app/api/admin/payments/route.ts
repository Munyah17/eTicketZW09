import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, reference, provider, amount, currency, status, metadata, error_message, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }

  const refs = (payments ?? []).map((p) => p.reference);
  const { data: tickets } = refs.length
    ? await supabase.from("tickets").select("payment_reference").in("payment_reference", refs)
    : { data: [] as { payment_reference: string }[] };
  const ticketedRefs = new Set((tickets ?? []).map((t) => t.payment_reference));

  return NextResponse.json({
    payments: (payments ?? []).map((p) => ({
      ...p,
      hasTicket: ticketedRefs.has(p.reference),
    })),
  });
}
