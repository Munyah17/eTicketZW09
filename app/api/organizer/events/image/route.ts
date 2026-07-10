import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_id", user.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found or unauthorized" }, { status: 404 });
  }

  const adminSupabase = createAdminClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `event-${eventId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminSupabase.storage
    .from("events")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = adminSupabase.storage.from("events").getPublicUrl(path);

  // Update event with the image URL
  const { error: updateError } = await supabase
    .from("events")
    .update({ image: pub.publicUrl })
    .eq("id", eventId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: pub.publicUrl });
}
