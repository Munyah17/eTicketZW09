import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Public — most of platform_config isn't sensitive, and this powers the
// site-wide announcement banner and payment-method gating for anonymous
// visitors. service_fee_percent and organizer_commission_percent are the
// exception: those rates are a trade secret (see memory:
// eticketzw-fee-secrecy) and must never reach a buyer's browser, so they're
// stripped unless the caller is an authenticated admin/super_admin — the
// only audience allowed to see them (the admin Platform Config page reads
// this same endpoint). Checkout gets computed dollar amounts instead, from
// POST /api/checkout/quote, never the raw rate.
const SENSITIVE_FIELDS = ["service_fee_percent", "organizer_commission_percent"] as const;

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("platform_config").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isPrivileged = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isPrivileged = profile?.role === "admin" || profile?.role === "super_admin";
  }

  if (!isPrivileged) {
    const redacted = { ...data };
    for (const field of SENSITIVE_FIELDS) delete (redacted as Record<string, unknown>)[field];
    return NextResponse.json({ config: redacted });
  }

  return NextResponse.json({ config: data });
}
