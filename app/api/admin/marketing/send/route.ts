import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";

type Audience = "all" | "customers" | "organizers" | "custom";

interface SendBody {
  audience: Audience;
  customIds?: string[];
  channels: { email: boolean; sms: boolean };
  subject: string;
  message: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body: SendBody = await req.json();
  const { audience, customIds, channels, subject, message } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }
  if (!channels?.email && !channels?.sms) {
    return NextResponse.json({ error: "Select at least one channel" }, { status: 400 });
  }

  const admin = createAdminClient();
  let query = admin.from("profiles").select("id, name, email, phone, role").in("role", ["customer", "organizer"]);

  if (audience === "customers") query = query.eq("role", "customer");
  else if (audience === "organizers") query = query.eq("role", "organizer");
  else if (audience === "custom") {
    if (!customIds || customIds.length === 0) {
      return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
    }
    query = query.in("id", customIds);
  }

  const { data: recipients, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contacts = recipients ?? [];
  let emailSent = 0;
  const smsSkipped = channels.sms ? contacts.filter((c) => c.phone).length : 0;

  if (channels.email) {
    const apiKey = process.env.RESEND_API_KEY;
    const emails = contacts.map((c) => c.email).filter(Boolean) as string[];

    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured — email could not be sent" }, { status: 503 });
    }

    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";
    const html = `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a; white-space: pre-wrap;">${message}</div>`;

    for (const batch of chunk(emails, 100)) {
      try {
        await resend.batch.send(batch.map((to) => ({ from, to, subject, html })));
        emailSent += batch.length;
      } catch (err) {
        logError("marketing_email_batch", err, { batchSize: batch.length });
      }
    }
  }

  return NextResponse.json({
    totalRecipients: contacts.length,
    emailSent,
    smsSkipped,
    smsNote: channels.sms ? "Bulk SMS isn't configured yet — no messages were sent via SMS." : undefined,
  });
}
