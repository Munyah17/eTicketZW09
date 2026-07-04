import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Marks a ticket's payment as refunded. Actual funds reversal happens
// outside this system (Stripe/Paynow dashboard) — this just records the
// outcome, same manual-processing pattern as payouts.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { ticketId } = body;
  if (!ticketId) return NextResponse.json({ error: "ticketId is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .update({ payment_status: "refunded" })
    .eq("id", ticketId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "ticket.refund",
    resourceType: "ticket",
    resourceId: ticketId,
    details: { amount: ticket.total_paid, buyer: ticket.buyer_name },
  });

  return NextResponse.json({ success: true });
}
