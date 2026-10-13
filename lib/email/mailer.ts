import nodemailer from "nodemailer";
import { logError } from "@/lib/error-logger";

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string | string[];
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  sent: boolean;
  via?: "smtp";
  error?: string;
}

// Single transport: the project's own cPanel mailbox over SMTP. No third-party
// relay — if this fails, the error is ours to see, not a platform's to hide.
// From is always the authenticated mailbox (cPanel rejects anything else),
// dressed with the platform display name.
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) {
    return { sent: false, error: "SMTP is not configured" };
  }
  const from = process.env.SMTP_FROM || `E-TicketsZW <${user}>`;

  // Every notification the platform sends is mirrored to the ops inbox —
  // ticket deliveries, sale alerts, payout notices, failure alerts, all of
  // it — so there's always a complete record of what actually went out.
  // Skipped only when the ops inbox is already the direct recipient.
  const opsInbox = process.env.NOTIFICATIONS_INBOX || "notifications@globalspaceweb.co.zw";
  const toList = Array.isArray(input.to) ? input.to : [input.to];
  const bcc = toList.includes(opsInbox) ? undefined : opsInbox;

  const port = Number(process.env.SMTP_PORT) || 465;
  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit SSL; 587 (or anything else) = STARTTLS
      auth: { user, pass: password },
    });

    await transport.sendMail({
      from,
      to: input.to,
      bcc,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments,
    });

    return { sent: true, via: "smtp" };
  } catch (err) {
    logError("smtp_send_failed", err, { to: input.to, subject: input.subject });
    return { sent: false, error: err instanceof Error ? err.message : "SMTP send failed" };
  }
}
