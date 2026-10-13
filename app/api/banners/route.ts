import { NextRequest, NextResponse } from "next/server";
import { getBanners } from "@/lib/public-events";

// Public — powers the homepage hero slider and section banners. Only
// "active" slots are ever returned. Served from the shared cached layer
// (60s, tag-invalidated on banner mutations) — every SectionBanner on the
// homepage used to trigger its own uncached Supabase query; repeat hits
// now skip the DB entirely.
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "hero" && type !== "section") {
    return NextResponse.json({ error: "type must be 'hero' or 'section'" }, { status: 400 });
  }

  try {
    const banners = await getBanners(type);
    return NextResponse.json({ banners });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch banners";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
