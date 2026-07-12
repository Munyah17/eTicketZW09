import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { sendTicketEmail } from "@/lib/email/send-ticket-email";
import { sendTicketWhatsApp } from "@/lib/whatsapp";
import { logError } from "@/lib/error-logger";

// Re-pushes an existing ticket to the buyer (email + WhatsApp). Recovery tool
// for tickets generated while delivery was failing (e.g. before the Resend
// domain was verified) — and for "I lost my ticket" support requests.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: ticket, error } = await admin.from("tickets").select("*").eq("id", id).single();
  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const pngData = {
    id: ticket.id,
    eventTitle: ticket.event_title,
    eventDate: ticket.event_date,
    eventTime: ticket.event_time,
    venue: ticket.venue,
    ticketTypeName: ticket.ticket_type_name,
    buyerName: ticket.buyer_name,
    buyerDisplayName: ticket.buyer_display_name,
    buyerEmail: ticket.buyer_email,
    totalPaid: Number(ticket.total_paid),
    currency: ticket.currency,
    paymentMethod: ticket.payment_method,
    purchasedAt: ticket.purchased_at,
    seatNumber: ticket.seat_number,
  };

  const [emailResult, whatsappResult] = await Promise.all([
    sendTicketEmail(pngData),
    sendTicketWhatsApp(pngData, ticket.buyer_contact || ""),
  ]);

  const issued = emailResult.sent || whatsappResult.sent;
  const now = new Date().toISOString();
  const priorLog = Array.isArray(ticket.delivery_log) ? ticket.delivery_log : [];
  const { error: updateError } = await admin
    .from("tickets")
    .update({
      email_delivered_at: emailResult.sent ? now : ticket.email_delivered_at,
      whatsapp_delivered_at: whatsappResult.sent ? now : ticket.whatsapp_delivered_at,
      issued_at: ticket.issued_at ?? (issued ? now : null),
      delivery_log: [
        ...priorLog,
        { channel: "email", at: now, resend_by: auth.user.email, ...emailResult },
        { channel: "whatsapp", at: now, resend_by: auth.user.email, ...whatsappResult },
      ],
    })
    .eq("id", ticket.id);
  if (updateError) {
    logError("ticket_resend_tracking_update_failed", updateError, { ticketId: ticket.id });
  }

  await admin.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "ticket.resend",
    resource_type: "ticket",
    resource_id: ticket.id,
    details: {
      buyer_email: ticket.buyer_email,
      email: emailResult.sent ? "delivered" : emailResult.error,
      whatsapp: whatsappResult.sent ? "delivered" : whatsappResult.error,
    },
  });

  return NextResponse.json({
    success: issued,
    email: emailResult,
    whatsapp: whatsappResult,
    message: issued
      ? `Ticket re-sent — email: ${emailResult.sent ? "delivered" : "failed"}, WhatsApp: ${whatsappResult.sent ? "delivered" : whatsappResult.skipped ? "not configured" : "failed"}`
      : `Delivery failed on all channels — email: ${emailResult.error}; WhatsApp: ${whatsappResult.error}`,
  });
}
