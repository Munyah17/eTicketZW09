import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { GeneratedTicket } from "@/lib/ticket-generator";
import { PLATFORM_FEE_PERCENTAGE, PLATFORM_FEE_FIXED } from "@/lib/types";
import { sendMail } from "@/lib/email/mailer";
import { formatMoney, wrapper, row } from "@/lib/email/html";
import { getSuperAdminEmails } from "@/lib/email/recipients";

const SALES_INBOX = "sales@eticket.co.zw";

// Fired alongside the buyer's ticket-delivery email whenever a sale
// completes. Two distinct, role-scoped notifications:
//  - sales@eticket.co.zw gets the full financial picture (admin-only data)
//  - the organizer gets their own event/earnings info, never the platform's
// The buyer already receives their own confirmation as part of the existing
// ticket-delivery email (lib/email/send-ticket-email.ts) — intentionally not
// duplicated here.
// Goes through lib/email/mailer.ts (Resend, falling back to SMTP).
export async function sendSaleNotificationEmails(ticket: GeneratedTicket): Promise<void> {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("organizer_id, organizer_name")
    .eq("id", ticket.eventId)
    .maybeSingle();

  const { data: config } = await admin.from("platform_config").select("service_fee_percent, service_fee_fixed").eq("id", 1).maybeSingle();
  const feePercent = Number(config?.service_fee_percent ?? PLATFORM_FEE_PERCENTAGE);
  const feeFixed = Number(config?.service_fee_fixed ?? PLATFORM_FEE_FIXED);
  // totalPaid = base + base*pct/100 + fixed  →  base = (totalPaid − fixed) / (1 + pct/100)
  const basePrice = (ticket.totalPaid - feeFixed) / (1 + feePercent / 100);
  const platformFee = ticket.totalPaid - basePrice;

  let organizerEmail: string | undefined;
  if (event?.organizer_id) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", event.organizer_id).maybeSingle();
    organizerEmail = profile?.email;
  }

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

  const superAdminEmails = await getSuperAdminEmails();
  const adminResult = await sendMail({
    to: SALES_INBOX,
    subject: `New Sale — ${ticket.eventTitle}`,
    html: adminHtml,
    replyTo: superAdminEmails,
  });
  if (!adminResult.sent) {
    logError("sale_notification_admin_email", new Error(adminResult.error || "send failed"), { ticketId: ticket.id });
  }

  if (organizerEmail && organizerHtml) {
    const organizerResult = await sendMail({
      to: organizerEmail,
      subject: `You made a sale — ${ticket.eventTitle}`,
      html: organizerHtml,
      replyTo: superAdminEmails,
    });
    if (!organizerResult.sent) {
      logError("sale_notification_organizer_email", new Error(organizerResult.error || "send failed"), { ticketId: ticket.id });
    }
  }
}
