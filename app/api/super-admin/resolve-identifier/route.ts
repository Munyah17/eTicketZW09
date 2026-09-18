import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Resolves a username to its account email for the /super-admin sign-in form.
// Deliberately only matches super_admin profiles — a general username→email
// lookup would be an account-enumeration oracle. Non-matching input returns
// the same 404 as a wrong username, so this endpoint never confirms whether
// a given username exists on a non-privileged account.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";

  if (!identifier || identifier.length > 320) {
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }

  // Already an email — nothing to resolve.
  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "super_admin")
    .ilike("username", identifier)
    .maybeSingle();

  if (!data?.email) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ email: data.email });
}
