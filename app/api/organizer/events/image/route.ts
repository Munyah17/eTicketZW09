import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";

// Matches the "events" storage bucket's allowed_mime_types exactly
// (supabase/migrations/20260710000000_create_events_storage_bucket.sql) —
// the upload input on the client accepts any "image/*", so a format outside
// this list (e.g. HEIC from an iPhone) passes client-side validation but is
// silently rejected by Storage. Extension-based fallback below covers the
// rest (some browser/OS combinations report an empty File.type).
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const EXT_TO_TYPE: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("image") as File | null;
  const eventId = form.get("eventId") as string | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

  // Verify the event belongs to this organizer
  const { data: event, error: lookupError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (lookupError) {
    logError("event_image_ownership_lookup_failed", lookupError, { eventId, userId: user.id });
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 404 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  // Some browser/OS combinations send an empty File.type for certain image
  // formats — fall back to inferring it from the extension rather than
  // letting Storage reject an empty content-type outright.
  const contentType = ALLOWED_TYPES.has(file.type) ? file.type : EXT_TO_TYPE[ext];
  if (!contentType) {
    return NextResponse.json(
      { error: "Unsupported image format. Please use PNG, JPG, WebP, or GIF." },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  const path = `event-${eventId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminSupabase.storage
    .from("events")
    .upload(path, buffer, { contentType, upsert: true });

  if (uploadError) {
    logError("event_image_storage_upload_failed", uploadError, { eventId, path, contentType });
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = adminSupabase.storage.from("events").getPublicUrl(path);

  // Ownership was already verified explicitly above — use the admin client
  // for the write itself so this can never fail on an RLS/session quirk
  // independent of that already-proven ownership check (the storage upload
  // above already happened; leaving the DB row unlinked from it on a
  // separate write-path failure was the exact class of bug this replaces).
  const { error: updateError } = await adminSupabase
    .from("events")
    .update({ image: pub.publicUrl })
    .eq("id", eventId);

  if (updateError) {
    logError("event_image_db_update_failed", updateError, { eventId, path });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: pub.publicUrl });
}
