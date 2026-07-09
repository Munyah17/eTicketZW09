import { Resend } from "resend";
import { renderTicketPng, TicketPngData } from "@/lib/ticket-png";
import { logError } from "@/lib/error-logger";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZW", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes ?? "00"} ${ampm}`;
}

function buildEmailHtml(ticket: TicketPngData): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <div style="background: #dc2626; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">E-TicketsZW</h1>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${ticket.buyerDisplayName || ticket.buyerName},</p>
        <p style="font-size: 15px;">Your ticket for <strong>${ticket.eventTitle}</strong> is confirmed. It's attached to this email as a PNG — save it or print it, then present it at the venue entrance.</p>
        <table style="width: 100%; font-size: 14px; margin-top: 16px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #64748b;">Event</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${ticket.eventTitle}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Date</td><td style="padding: 6px 0; text-align: right;">${formatDate(ticket.eventDate)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Time</td><td style="padding: 6px 0; text-align: right;">${formatTime(ticket.eventTime)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Venue</td><td style="padding: 6px 0; text-align: right;">${ticket.venue}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Ticket Type</td><td style="padding: 6px 0; text-align: right;">${ticket.ticketTypeName}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Ticket ID</td><td style="padding: 6px 0; text-align: right; font-family: monospace;">${ticket.id}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Amount Paid</td><td style="padding: 6px 0; text-align: right;">${ticket.currency} ${ticket.totalPaid.toFixed(2)}</td></tr>
        </table>
        <p style="font-size: 13px; color: #64748b; margin-top: 20px;">This ticket is unique to you — please don't forward it. See you there!</p>
      </div>
    </div>
  `;
}

// Fired right after a ticket is generated for a successful payment.
// Sends downloadable ticket to buyer's email address.
// Critical: requires RESEND_API_KEY environment variable to be set.
export async function sendTicketEmail(ticket: TicketPngData): Promise<void> {
  if (!ticket.buyerEmail) {
    console.warn("sendTicketEmail: no buyer email on ticket", ticket.id);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "CRITICAL: RESEND_API_KEY not configured — TICKET EMAILS ARE NOT BEING SENT!",
      "Ticket ID:",
      ticket.id,
      "Buyer Email:",
      ticket.buyerEmail
    );
    logError("ticket_email_not_sent", new Error("RESEND_API_KEY missing"), {
      ticketId: ticket.id,
      buyerEmail: ticket.buyerEmail,
      reason: "Email service not configured",
    });
    return;
  }

  try {
    const png = await renderTicketPng(ticket);
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";

    const { error } = await resend.emails.send({
      from,
      to: ticket.buyerEmail,
      subject: `Your ticket for ${ticket.eventTitle}`,
      html: buildEmailHtml(ticket),
      attachments: [
        {
          filename: `ticket-${ticket.id}.png`,
          content: png,
        },
      ],
    });

    if (error) {
      logError("ticket_email_send_failed", error, {
        ticketId: ticket.id,
        buyerEmail: ticket.buyerEmail,
        eventTitle: ticket.eventTitle,
      });
      console.error("Failed to send ticket email:", error, "to:", ticket.buyerEmail);
    } else {
      console.log("✓ Ticket email sent successfully to:", ticket.buyerEmail, "for ticket:", ticket.id);
    }
  } catch (err) {
    logError("ticket_email_generation_failed", err, { ticketId: ticket.id, buyerEmail: ticket.buyerEmail });
    console.error("Error generating/sending ticket email:", err);
  }
}
