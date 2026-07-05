import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public — bumps a banner's view counter by one. Fire-and-forget from the
// homepage; the DB function only touches active banners, so bogus ids are
// silently a no-op.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("increment_banner_impression", { banner_id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
