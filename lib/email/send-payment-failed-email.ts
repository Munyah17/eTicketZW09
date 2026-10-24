import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper } from "@/lib/email/html";

interface FailedPaymentInfo {
  reference: string;
  buyerEmail?: string;
  eventTitle?: string;
  eventId?: string;
}

// Fired whenever a checkout payment ends up "failed" (buyer cancelled,
// wrong PIN, insufficient funds, gateway declined, etc.) — today the buyer
// would only find out by noticing nothing arrived. Best-effort: skipped
// silently if there's no buyer email or event context to link back to.
export async function sendPaymentFailedEmail(info: FailedPaymentInfo): Promise<void> {
  // No buyer email → send to the sales inbox instead of dropping the alert —
  // a failed payment is a lost sale and must never leave the admin blind.
  const recipient = info.buyerEmail || "sales@eticket.co.zw";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://www.eticket.co.zw";
  const retryUrl = info.eventId ? `${baseUrl}/events/${info.eventId}` : baseUrl;

  const html = wrapper(
    "#dc2626",
    "Payment Didn't Go Through",
    `
      <p style="font-size: 15px;">
        Your payment${info.eventTitle ? ` for <strong>${info.eventTitle}</strong>` : ""} wasn't completed,
        so no ticket was issued and you weren't charged.
      </p>
      <p style="font-size: 14px; color: #64748b; margin-top: 8px;">
        This can happen from a cancelled prompt, an incorrect PIN, or insufficient funds. You can try again below.
      </p>
      <p style="margin-top: 20px;">
        <a href="${retryUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Try Again
        </a>
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Reference: ${info.reference}</p>
    `
  );

  const result = await sendMail({
    to: recipient,
    subject: info.eventTitle ? `Your payment for ${info.eventTitle} didn't go through` : "Your payment didn't go through",
    html,
  });
  if (!result.sent) {
    logError("payment_failed_email_failed", new Error(result.error || "send failed"), { reference: info.reference });
  }
}
