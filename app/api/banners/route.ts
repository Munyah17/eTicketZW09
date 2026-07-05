import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public — powers the homepage hero slider and section banners. Only
// "active" slots (i.e. an admin has uploaded an image) are ever returned.
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "hero" && type !== "section") {
    return NextResponse.json({ error: "type must be 'hero' or 'section'" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("banners")
    .select("id, type, position, image, link, title, impressions")
    .eq("type", type)
    .eq("status", "active")
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banners: data ?? [] });
}
