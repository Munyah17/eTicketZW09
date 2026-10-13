import { NextRequest, NextResponse } from "next/server";
import { getPublishedEvents } from "@/lib/public-events";

// Full published catalog — served from the shared cached layer (60s per
// search/category/city/sort combination, tag-invalidated on event
// mutations). The query + mapping logic lives in lib/public-events.ts so
// this route and the SSR /allevents page render from the same data.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  try {
    const events = await getPublishedEvents({
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      city: searchParams.get("city") || "",
      sort: searchParams.get("sort") || "date-asc",
    });
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Events list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
