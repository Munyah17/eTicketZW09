import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Marks a ticket's payment as refunded. Actual funds reversal happens
// outside this system (Paynow dashboard) — this just records the
// outcome, same manual-processing pattern as payouts.
//
// Guards:
//  - Only a ticket whose payment actually completed can be refunded — you
//    can't "refund" a pending/failed order or double-refund an already
//    refunded one.
//  - The payments row is updated too, so the payment ledger and the ticket
//    rows can't disagree about whether money was returned.
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { ticketId } = body;
  if (!ticketId) return NextResponse.json({ error: "ticketId is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: ticket, error: fetchError } = await supabase
    .from("tickets")
    .select("id, payment_reference, payment_status, total_paid, buyer_name")
    .eq("id", ticketId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (ticket.payment_status !== "completed") {
    return NextResponse.json(
      { error: `Cannot refund a ticket whose payment is "${ticket.payment_status}" — only completed payments are refundable.` },
      { status: 409 }
    );
  }

  // Refund the whole payment, not just this one ticket row — a multi-ticket
  // order mints N rows under one payment_reference, and all of them are
  // invalidated when the money goes back.
  if (ticket.payment_reference) {
    const { error: payError } = await supabase
      .from("payments")
      .update({ status: "refunded" })
      .eq("reference", ticket.payment_reference);
    if (payError) return NextResponse.json({ error: payError.message }, { status: 500 });

    const { error: tixError } = await supabase
      .from("tickets")
      .update({ payment_status: "refunded" })
      .eq("payment_reference", ticket.payment_reference);
    if (tixError) return NextResponse.json({ error: tixError.message }, { status: 500 });
  } else {
    const { error: tixError } = await supabase
      .from("tickets")
      .update({ payment_status: "refunded" })
      .eq("id", ticketId);
    if (tixError) return NextResponse.json({ error: tixError.message }, { status: 500 });
  }

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "ticket.refund",
    resourceType: "ticket",
    resourceId: ticketId,
    details: { amount: ticket.total_paid, buyer: ticket.buyer_name, paymentReference: ticket.payment_reference },
  });

  return NextResponse.json({ success: true });
}
