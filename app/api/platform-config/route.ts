import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public — nothing in platform_config is sensitive. Powers the site-wide
// announcement banner, checkout's dynamic fee, and payment-method gating.
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("platform_config").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
