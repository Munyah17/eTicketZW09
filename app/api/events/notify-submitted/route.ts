import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEventSubmittedEmail } from "@/lib/email/send-event-review-notification";

// Fired by the create-event page right after ANY new event is saved —
// pending_review or auto-approved — so a new listing never lands without
// the super admins and the creator both getting an email.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Ownership check — this endpoint must not be usable to spam review
  // notifications for events that aren't the caller's own.
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ success: true }); // not the caller's event — nothing to notify
  }

  after(() => sendEventSubmittedEmail(eventId).catch(() => {}));
  // New listing — bust the public events cache so it shows up on the
  // homepage and /allevents right away instead of up to 60s later.
  revalidateTag("events", "max");
  return NextResponse.json({ success: true });
}
