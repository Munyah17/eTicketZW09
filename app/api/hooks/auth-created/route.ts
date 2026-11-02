import { NextRequest, NextResponse, after } from "next/server";
import { sendSignupNotification } from "@/lib/email/send-signup-notification";

// GoTrue after_user_created hook target — fires server-side after every new
// auth user, so signup alerts don't depend on the client sticking around.
// The shared key travels in the hook URL's query string; without it the
// endpoint is a no-op rather than an open spam relay.
interface HookUser {
  email?: string;
  user_metadata?: { name?: string; role?: string };
}

// The response GoTrue hooks expect: 2xx + {"decision":"continue"} lets the
// signup through; anything else rejects it. Because hooks run inside the
// signup transaction, this endpoint must NEVER return an error status —
// a 401 from a missing/mismatched SIGNUP_HOOK_SECRET previously turned a
// notification misconfiguration into a total signup outage for every role.
// The secret now gates only the notification send; an unauthenticated call
// gets "continue" and does nothing, which stays spam-safe.
export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.SIGNUP_HOOK_SECRET;
  if (!expected || key !== expected) {
    console.warn("auth-created hook: SIGNUP_HOOK_SECRET missing or mismatched — notification skipped, signup allowed");
    return NextResponse.json({ decision: "continue" });
  }

  const body = (await req.json().catch(() => ({}))) as { user?: HookUser };
  const user = body.user;
  const email = user?.email;
  if (email) {
    after(() =>
      sendSignupNotification({
        email,
        name: user.user_metadata?.name,
        role: user.user_metadata?.role,
        success: true,
      }).catch(() => {})
    );
  }

  return NextResponse.json({ decision: "continue" });
}
