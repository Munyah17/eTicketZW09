import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEventSubmittedEmail } from "@/lib/email/send-event-review-notification";

// Fired by the create-event page right after a new event lands in
// pending_review (auto-approve off), so Admin gets notified without
// having to poll the Events & Markups page.
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
    .select("title, organizer_name, status")
    .eq("id", eventId)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (!event || event.status !== "pending_review") {
    return NextResponse.json({ success: true }); // nothing to notify, not an error
  }

  sendEventSubmittedEmail(eventId, event.title, event.organizer_name).catch(() => {});
  return NextResponse.json({ success: true });
}
