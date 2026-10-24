import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing target for GoTrue email links (signup confirmation, password
// recovery, email change). Handles both the PKCE `?code=` redirect and the
// `?token_hash=&type=` template style. GoTrue has already confirmed the
// email before redirecting here, so if the session exchange fails (link
// opened on a different device/browser than the one that signed up — the
// PKCE verifier cookie isn't there) the user is still sent to sign in with
// a "confirmed" notice instead of a dead end.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`);
  }

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);

  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("This reset link is invalid or has expired. Request a new one below.")}`);
  }
  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
