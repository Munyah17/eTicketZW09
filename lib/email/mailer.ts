import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logError } from "@/lib/error-logger";

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  sent: boolean;
  via?: "resend" | "smtp";
  error?: string;
}

// Resend's sending domain has never been verified (open risk — see memory:
// eticketzw-open-risks), so it can silently fail or restrict delivery.
// Every email in this app goes through here: try Resend first (cheap, fast,
// already wired), and if it's unconfigured or the send itself fails, fall
// back to the SMTP mailbox instead of just giving up. Nothing upstream
// needs to know which transport actually delivered it.
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";

  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments,
      });
      if (!error) return { sent: true, via: "resend" };
      logError("resend_send_failed", error, { to: input.to, subject: input.subject });
    } catch (err) {
      logError("resend_send_threw", err, { to: input.to, subject: input.subject });
    }
  }

  const smtpResult = await sendViaSmtp(input);
  if (smtpResult.sent) return smtpResult;

  return {
    sent: false,
    error: smtpResult.error || (resendKey ? "Resend failed and SMTP is not configured" : "No email transport configured"),
  };
}

async function sendViaSmtp(input: SendMailInput): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) {
    return { sent: false, error: "SMTP is not configured" };
  }

  // Deliberately its own "from", independent of EMAIL_FROM (which governs
  // Resend's identity) — most SMTP servers, cPanel mailboxes especially,
  // reject or flag a send whose From address doesn't match the
  // authenticated account, so this fallback must always send as the
  // mailbox it actually authenticated with.
  const from = process.env.SMTP_FROM || `E-TicketsZW <${user}>`;

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
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });

    return { sent: true, via: "smtp" };
  } catch (err) {
    logError("smtp_send_failed", err, { to: input.to, subject: input.subject });
    return { sent: false, error: err instanceof Error ? err.message : "SMTP send failed" };
  }
}
