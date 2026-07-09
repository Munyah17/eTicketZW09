import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { GeneratedTicket } from "@/lib/ticket-generator";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/types";

const SALES_INBOX = "sales@eticket.co.zw";

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function wrapper(accentColor: string, heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <div style="background: ${accentColor}; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">${heading}</h1>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding: 6px 0; color: #64748b;">${label}</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${value}</td></tr>`;
}

// Fired alongside the buyer's ticket-delivery email whenever a sale
// completes. Two distinct, role-scoped notifications:
//  - sales@eticket.co.zw gets the full financial picture (admin-only data)
//  - the organizer gets their own event/earnings info, never the platform's
// The buyer already receives their own confirmation as part of the existing
// ticket-delivery email (lib/email/send-ticket-email.ts) — intentionally not
// duplicated here.
// Critical: requires RESEND_API_KEY environment variable to be set.
export async function sendSaleNotificationEmails(ticket: GeneratedTicket): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "CRITICAL: RESEND_API_KEY not configured — SALE NOTIFICATION EMAILS ARE NOT BEING SENT!",
      "Ticket ID:",
      ticket.id,
      "Event:",
      ticket.eventTitle
    );
    logError("sale_notification_emails_not_sent", new Error("RESEND_API_KEY missing"), {
      ticketId: ticket.id,
      eventTitle: ticket.eventTitle,
      reason: "Email service not configured",
    });
    return;
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("organizer_id, organizer_name")
    .eq("id", ticket.eventId)
    .maybeSingle();

  const { data: config } = await admin.from("platform_config").select("service_fee_percent").eq("id", 1).maybeSingle();
  const feePercent = Number(config?.service_fee_percent ?? PLATFORM_FEE_PERCENTAGE);
  const basePrice = ticket.totalPaid / (1 + feePercent / 100);
  const platformFee = ticket.totalPaid - basePrice;

  let organizerEmail: string | undefined;
  if (event?.organizer_id) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", event.organizer_id).maybeSingle();
    organizerEmail = profile?.email;
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";

  const adminHtml = wrapper(
    "#0f172a",
    "New Sale",
    `
      <p style="font-size: 14px; color: #64748b;">A ticket was just sold for <strong>${ticket.eventTitle}</strong>.</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Ticket ID", `<span style="font-family: monospace;">${ticket.id}</span>`)}
        ${row("Event", ticket.eventTitle)}
        ${row("Ticket Type", ticket.ticketTypeName)}
        ${row("Buyer", `${ticket.buyerName} (${ticket.buyerEmail})`)}
        ${row("Buyer Phone", ticket.buyerContact)}
        ${row("Organizer", `${event?.organizer_name || "Unknown"}${organizerEmail ? ` (${organizerEmail})` : ""}`)}
        ${row("Payment Method", ticket.paymentMethod.toUpperCase())}
        ${row("Amount Paid (Gross)", formatMoney(ticket.totalPaid))}
        ${row(`Platform Fee (${feePercent}%)`, formatMoney(platformFee))}
        ${row("Organizer Net", formatMoney(basePrice))}
      </table>
    `
  );

  const organizerHtml = organizerEmail
    ? wrapper(
        "#2563eb",
        "You Made a Sale!",
        `
          <p style="font-size: 15px;">Good news — someone just bought a ticket to <strong>${ticket.eventTitle}</strong>.</p>
          <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
            ${row("Ticket Type", ticket.ticketTypeName)}
            ${row("Buyer", ticket.buyerDisplayName)}
            ${row("Buyer Contact", ticket.buyerContact)}
            ${row("Your Earnings", formatMoney(basePrice))}
          </table>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Earnings shown are your share before payout processing. View full sales history in your organizer dashboard.</p>
        `
      )
    : null;

  try {
    await resend.emails.send({ from, to: SALES_INBOX, subject: `New Sale — ${ticket.eventTitle}`, html: adminHtml });
  } catch (err) {
    logError("sale_notification_admin_email", err, { ticketId: ticket.id });
  }

  if (organizerEmail && organizerHtml) {
    try {
      await resend.emails.send({
        from,
        to: organizerEmail,
        subject: `You made a sale — ${ticket.eventTitle}`,
        html: organizerHtml,
      });
    } catch (err) {
      logError("sale_notification_organizer_email", err, { ticketId: ticket.id });
    }
  }
}
