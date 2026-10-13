import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper, row } from "@/lib/email/html";
import { getSuperAdminEmails } from "@/lib/email/recipients";
import { sendSms } from "@/lib/sms";

// Ops phone for failed-purchase SMS alerts — overridable via env.
const SMS_ALERT_RECIPIENT = process.env.SMS_ALERT_RECIPIENT || "+263773909307";

export interface FailedPurchaseInfo {
  reference?: string;
  eventTitle?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  reason: string;
  stage: "initiation" | "payment";
}

// Fired on EVERY failed ticket purchase — whether the gateway rejected the
// initiation (misconfigured keys, provider down) or the payment itself
// failed after initiation (cancelled PIN prompt, insufficient funds,
// declined). A lost sale used to be invisible until someone noticed; now
// the super admins get an email AND an SMS within seconds.
// Best-effort: never throws, never blocks the response to the buyer.
export async function sendFailedPurchaseAlert(info: FailedPurchaseInfo): Promise<void> {
  const superAdminEmails = await getSuperAdminEmails();
  const when = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const html = wrapper(
    "#dc2626",
    "Failed Ticket Purchase",
    `
      <p style="font-size: 15px;">A ticket purchase just failed${info.stage === "initiation" ? " at payment initiation — the buyer never even reached the payment step" : ""}.</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Event", `<strong>${info.eventTitle || "Unknown"}</strong>`)}
        ${row("Buyer", info.buyerEmail || "—")}
        ${row("Buyer Phone", info.buyerPhone || "—")}
        ${row("Provider", (info.provider || "—").toUpperCase())}
        ${row("Amount", info.amount != null ? `${info.amount} ${info.currency || ""}`.trim() : "—")}
        ${row("Stage", info.stage === "initiation" ? "Payment initiation" : "Payment")}
        ${row("Reason", info.reason)}
        ${row("Reference", `<span style="font-family: monospace;">${info.reference || "—"}</span>`)}
        ${row("Time", when)}
      </table>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Check the payment gateway configuration and the payments log for this reference.</p>
    `
  );

  const smsText =
    `E-TicketsZW FAILED SALE: ${info.eventTitle || "event"} | ` +
    `${info.buyerEmail || "unknown buyer"} | ${(info.provider || "?").toUpperCase()} | ` +
    `${info.reason.slice(0, 60)}${info.reference ? ` | ref ${info.reference.slice(0, 8)}` : ""}`;

  const [emailResult, smsResult] = await Promise.all([
    sendMail({
      to: superAdminEmails,
      subject: `Failed Ticket Purchase — ${info.eventTitle || info.reason.slice(0, 50)}`,
      html,
      replyTo: superAdminEmails,
    }),
    sendSms(SMS_ALERT_RECIPIENT, smsText),
  ]);

  if (!emailResult.sent) {
    logError("failed_purchase_alert_email", new Error(emailResult.error || "send failed"), { reference: info.reference });
  }
  if (!smsResult.sent && !smsResult.skipped) {
    logError("failed_purchase_alert_sms", new Error(smsResult.error || "send failed"), { reference: info.reference });
  }
}
