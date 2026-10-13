import { NextRequest, NextResponse, after } from "next/server";
import { sendSignupNotification } from "@/lib/email/send-signup-notification";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Client-reported signup failures — the register page POSTs here when GoTrue
// rejects a signup, since the after_user_created hook only sees successes.
// Unauthenticated by necessity (the caller has no session yet); the worst a
// forged request can do is email our own ops inbox, so validation is kept
// to shape-checking.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; reason?: string };
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "Unknown error";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  after(() => sendSignupNotification({ email, success: false, reason }).catch(() => {}));
  return NextResponse.json({ success: true });
}
