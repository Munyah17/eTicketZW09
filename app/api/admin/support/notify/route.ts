import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Sends a real one-off email to a user from the admin Support panel.
// No-ops (with a clear error) if RESEND_API_KEY isn't configured.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { toEmail, toName, message } = body;
  if (!toEmail || !message) {
    return NextResponse.json({ error: "toEmail and message are required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured — email cannot be sent" }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";

  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: "A message from E-TicketsZW Support",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <div style="background: #dc2626; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">E-TicketsZW</h1>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi ${toName || "there"},</p>
          <p style="font-size: 15px; white-space: pre-wrap;">${message}</p>
          <p style="font-size: 13px; color: #64748b; margin-top: 20px;">— E-TicketsZW Support</p>
        </div>
      </div>
    `,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "platform.announcement",
    resourceType: "user",
    resourceId: toEmail,
    details: { message: message.slice(0, 200) },
  });

  return NextResponse.json({ success: true });
}
