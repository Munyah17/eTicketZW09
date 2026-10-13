import { NextResponse } from "next/server";
import { getHomeSections } from "@/lib/public-events";

// Homepage sections — served from the shared cached layer (60s,
// tag-invalidated on event mutations). The query + scoring logic lives in
// lib/public-events.ts so this route and the SSR homepage render from the
// exact same data.
export async function GET() {
  try {
    const sections = await getHomeSections();
    return NextResponse.json(sections);
  } catch (err) {
    // A query error must not be swallowed into "zero events" — that reads to
    // every visitor as "this platform has nothing on it" instead of the
    // transient DB hiccup it actually is.
    const message = err instanceof Error ? err.message : "Failed to load events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
