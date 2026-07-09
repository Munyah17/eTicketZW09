import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * System endpoint to check email configuration status
 * This helps diagnose if ticket emails will be sent
 *
 * POST /api/system/email-status - Run a test
 * GET /api/system/email-status - Check configuration
 */

async function checkEmailConfiguration() {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "E-TicketsZW <pay@eticket.co.zw>";

  return {
    configured: hasResendKey,
    resendKeySet: hasResendKey,
    emailFrom,
    message: hasResendKey
      ? "✓ Email service configured - emails should be sent"
      : "✗ RESEND_API_KEY not set - EMAILS WILL NOT BE SENT",
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Only allow admin access for this diagnostic endpoint
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 });
  }

  const config = await checkEmailConfiguration();
  return NextResponse.json({
    status: "ok",
    emailConfiguration: config,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { testEmail } = body;

  if (!testEmail) {
    return NextResponse.json({ error: "testEmail required" }, { status: 400 });
  }

  const config = await checkEmailConfiguration();

  if (!config.configured) {
    return NextResponse.json({
      status: "error",
      message: "Email service not configured",
      details: config,
      recommendation: "Set RESEND_API_KEY environment variable",
    }, { status: 503 });
  }

  // Test email sending
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: config.emailFrom,
      to: testEmail,
      subject: "E-TicketsZW Email Configuration Test",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
          <div style="background: #22c55e; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">✓ Email Service Working</h1>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px;">This is a test email from E-TicketsZW.</p>
            <p style="font-size: 14px; color: #64748b;">If you received this, the email service is configured correctly and buyers will receive their ticket confirmation emails.</p>
            <div style="background: #ecfdf5; border: 1px solid #86efac; padding: 12px; border-radius: 6px; margin-top: 16px;">
              <p style="margin: 0; font-size: 13px; color: #166534;"><strong>Configuration Status:</strong></p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #166534;">
                <li>RESEND_API_KEY: Configured ✓</li>
                <li>Email From: ${config.emailFrom}</li>
                <li>Test Email Sent: ${new Date().toISOString()}</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({
        status: "error",
        message: "Email sending failed",
        error: error,
        configuration: config,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      message: "Test email sent successfully",
      configuration: config,
      recommendation: "Email service is working correctly - buyers will receive tickets",
      testEmail,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      message: "Failed to send test email",
      error: err instanceof Error ? err.message : "Unknown error",
      configuration: config,
    }, { status: 500 });
  }
}
