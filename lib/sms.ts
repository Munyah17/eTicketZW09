import { logError } from "@/lib/error-logger";
import { normalizeZimPhone } from "@/lib/whatsapp";

// Afrosoft SMS gateway — transactional alerts (failed purchases, critical
// events) pushed to the ops phone. Afrosoft's HTTP API isn't publicly
// documented, so the endpoint and field names are fully env-configurable;
// confirm the exact contract with Afrosoft and adjust AFROSOFT_SMS_URL /
// the payload shape here if their spec differs.
//
// Required env:
//   AFROSOFT_SMS_URL        — send endpoint, e.g. https://sms.afrosoft.co.zw/api/send
//   AFROSOFT_SMS_USERNAME   — gateway account username / API user
//   AFROSOFT_SMS_PASSWORD   — gateway account password / API secret
// Optional env:
//   AFROSOFT_SMS_SENDER_ID  — approved sender ID (default "E-TicketsZW")

export interface SmsSendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const url = process.env.AFROSOFT_SMS_URL;
  const username = process.env.AFROSOFT_SMS_USERNAME;
  const password = process.env.AFROSOFT_SMS_PASSWORD;

  if (!url || !username || !password) {
    return { sent: false, skipped: true, error: "Afrosoft SMS not configured (AFROSOFT_SMS_URL / USERNAME / PASSWORD)" };
  }

  const msisdn = normalizeZimPhone(to);
  if (!msisdn) {
    return { sent: false, skipped: true, error: `Invalid recipient number ("${to}")` };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        sender_id: process.env.AFROSOFT_SMS_SENDER_ID || "E-TicketsZW",
        to: msisdn,
        message,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Afrosoft SMS failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return { sent: true };
  } catch (err) {
    logError("afrosoft_sms_send_failed", err, { to: msisdn });
    return { sent: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}
