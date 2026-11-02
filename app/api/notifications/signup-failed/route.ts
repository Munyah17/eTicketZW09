import { NextRequest, NextResponse, after } from "next/server";
import { sendSignupNotification } from "@/lib/email/send-signup-notification";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FAILURE_DEDUPE_MS = 15 * 60 * 1000;
const recentFailures = new Map<string, number>();

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

  // A stuck signup form can POST dozens of identical failures (one user hit
  // the ops inbox 40 times). Dedupe per email+reason — the first alert is
  // the actionable one. In-memory, so it only throttles within a warm
  // serverless instance; still enough to kill retry storms.
  const dedupeKey = `${email.toLowerCase()}|${reason}`;
  const lastSent = recentFailures.get(dedupeKey) ?? 0;
  if (Date.now() - lastSent >= FAILURE_DEDUPE_MS) {
    recentFailures.set(dedupeKey, Date.now());
    if (recentFailures.size > 500) {
      const cutoff = Date.now() - FAILURE_DEDUPE_MS;
      for (const [k, t] of recentFailures) if (t < cutoff) recentFailures.delete(k);
    }
    after(() => sendSignupNotification({ email, success: false, reason }).catch(() => {}));
  }

  return NextResponse.json({ success: true });
}
