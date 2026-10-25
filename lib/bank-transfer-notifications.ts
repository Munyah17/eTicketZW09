import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper, row } from "@/lib/email/html";
import { getSuperAdminEmails } from "@/lib/email/recipients";
import { sendSms } from "@/lib/sms";
import { sendWhatsAppText } from "@/lib/whatsapp";

// Ops phone for on-hold-order SMS alerts — same recipient as failed
// purchases, overridable via env.
const SMS_ALERT_RECIPIENT = process.env.SMS_ALERT_RECIPIENT || "+263773909307";

export interface BankTransferOrderInfo {
  reference: string;
  eventTitle?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  amount?: number;
  currency?: string;
  transactionReference?: string;
  hasProof?: boolean;
}

// Fired when a bank-transfer order is submitted (proof uploaded and/or a
// transaction reference entered). Mirrors the failed-purchase alert surface —
// super admin email + ops SMS — so an on-hold order is never discovered
// days later. Best-effort: never throws, never blocks the buyer response.
export async function notifyBankTransferSubmitted(info: BankTransferOrderInfo): Promise<void> {
  const superAdminEmails = await getSuperAdminEmails();
  const when = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const html = wrapper(
    "#d97706",
    "Bank Transfer Order — Action Required",
    `
      <p style="font-size: 15px;">A buyer submitted a bank transfer order. Verify the deposit in the FBC account, then approve, reject or request more information from the payments dashboard.</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Event", `<strong>${info.eventTitle || "Unknown"}</strong>`)}
        ${row("Buyer", info.buyerName || "—")}
        ${row("Buyer Email", info.buyerEmail || "—")}
        ${row("Buyer Phone", info.buyerPhone || "—")}
        ${row("Amount", info.amount != null ? `${info.amount} ${info.currency || ""}`.trim() : "—")}
        ${row("Transaction Ref", info.transactionReference || "—")}
        ${row("Proof Uploaded", info.hasProof ? "Yes" : "No")}
        ${row("Reference", `<span style="font-family: monospace;">${info.reference}</span>`)}
        ${row("Time", when)}
      </table>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Review it under Payment Verification — on-hold orders never issue a ticket until approved.</p>
    `
  );

  const smsText =
    `E-TicketsZW BANK TRANSFER: ${info.eventTitle || "event"} | ` +
    `${info.buyerName || info.buyerEmail || "buyer"} | ${info.amount ?? "?"} ${info.currency || ""} | ` +
    `txn ${info.transactionReference || "none"} | ref ${info.reference.slice(0, 8)} — verify & review`;

  const [emailResult, smsResult] = await Promise.all([
    sendMail({
      to: superAdminEmails,
      subject: `Bank Transfer to Verify — ${info.eventTitle || info.reference.slice(0, 8)}`,
      html,
      replyTo: info.buyerEmail || superAdminEmails,
    }),
    sendSms(SMS_ALERT_RECIPIENT, smsText),
  ]);

  if (!emailResult.sent) {
    logError("bank_transfer_alert_email", new Error(emailResult.error || "send failed"), { reference: info.reference });
  }
  if (!smsResult.sent && !smsResult.skipped) {
    logError("bank_transfer_alert_sms", new Error(smsResult.error || "send failed"), { reference: info.reference });
  }
}

export type BankTransferDecision = "approved" | "rejected" | "info_requested";

// Notifies the buyer of the admin's review decision on BOTH channels the
// platform promises — email and WhatsApp. Rejections and info requests carry
// the reason so the buyer knows exactly what to fix. Best-effort per channel.
export async function sendBankTransferDecision(
  decision: BankTransferDecision,
  info: BankTransferOrderInfo & { reason?: string }
): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const name = info.buyerName || "there";
  const amountLine = info.amount != null ? `${info.amount} ${info.currency || ""}`.trim() : "";

  const copy = {
    approved: {
      heading: "Bank Transfer Verified — Ticket Issued",
      color: "#059669",
      body: `Good news${name ? `, ${name}` : ""} — we verified your bank transfer${amountLine ? ` of <strong>${amountLine}</strong>` : ""} for <strong>${info.eventTitle || "your event"}</strong>. Your ticket has been issued and sent to you separately by email and WhatsApp.`,
      wa: `E-TicketsZW: Your bank transfer for ${info.eventTitle || "your order"} (${info.reference.slice(0, 8)}) has been VERIFIED. Your ticket has been issued — check your email/WhatsApp for it.`,
    },
    rejected: {
      heading: "Bank Transfer Rejected",
      color: "#dc2626",
      body: `Hi ${name}, we could not verify your bank transfer${amountLine ? ` of <strong>${amountLine}</strong>` : ""} for <strong>${info.eventTitle || "your event"}</strong>, so the order was rejected.<br/><br/><strong>Reason:</strong> ${info.reason || "—"}<br/><br/>If you believe this is a mistake, reply to this email or contact support with your payment reference.`,
      wa: `E-TicketsZW: Your bank transfer for ${info.eventTitle || "your order"} (${info.reference.slice(0, 8)}) was REJECTED. Reason: ${info.reason || "not provided"}. Contact support if this is a mistake.`,
    },
    info_requested: {
      heading: "More Information Needed — Bank Transfer",
      color: "#d97706",
      body: `Hi ${name}, we're reviewing your bank transfer${amountLine ? ` of <strong>${amountLine}</strong>` : ""} for <strong>${info.eventTitle || "your event"}</strong> but need more information before we can approve it.<br/><br/><strong>What we need:</strong> ${info.reason || "—"}<br/><br/>Open your order page to upload a new proof of payment or update your transaction reference.`,
      wa: `E-TicketsZW: Your bank transfer for ${info.eventTitle || "your order"} (${info.reference.slice(0, 8)}) needs more info: ${info.reason || "see your order page"}. Re-submit proof/reference on your order page.`,
    },
  }[decision];

  const html = wrapper(
    copy.color,
    copy.heading,
    `
      <p style="font-size: 15px;">${copy.body}</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Event", `<strong>${info.eventTitle || "—"}</strong>`)}
        ${row("Amount", amountLine || "—")}
        ${row("Transaction Ref", info.transactionReference || "—")}
        ${row("Order Reference", `<span style="font-family: monospace;">${info.reference}</span>`)}
      </table>
    `
  );

  const [emailResult, waResult] = await Promise.all([
    info.buyerEmail
      ? sendMail({
          to: info.buyerEmail,
          subject: `${copy.heading} — ${info.eventTitle || "E-TicketsZW order"}`,
          html,
        })
      : Promise.resolve({ sent: false, error: "No buyer email" }),
    info.buyerPhone
      ? sendWhatsAppText(info.buyerPhone, copy.wa)
      : Promise.resolve({ sent: false, skipped: true, error: "No buyer phone" }),
  ]);

  if (!emailResult.sent) {
    logError("bank_transfer_decision_email", new Error(emailResult.error || "send failed"), { reference: info.reference, decision });
  }
  if (!waResult.sent && !waResult.skipped) {
    logError("bank_transfer_decision_whatsapp", new Error(waResult.error || "send failed"), { reference: info.reference, decision });
  }

  return { emailSent: !!emailResult.sent, whatsappSent: !!waResult.sent };
}
