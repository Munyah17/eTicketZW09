import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper, row } from "@/lib/email/html";
import { getSuperAdminEmails } from "@/lib/email/recipients";

// Fired on EVERY event submission — auto-approved or pending review — so a
// new listing never lands silently. Two emails go out:
//  - "New Event Registration" to every super_admin (they're the ones who
//    need to know a listing exists, review or not)
//  - a confirmation to the creator's registered email
// Replies on both route back to the super admins.
export async function sendEventSubmittedEmail(eventId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("title, organizer_name, organizer_id, status, date, venue, city")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return;

  const superAdminEmails = await getSuperAdminEmails();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://eticket.co.zw";
  const pending = event.status === "pending_review";

  const adminHtml = wrapper(
    "#0f172a",
    "New Event Registration",
    `
      <p style="font-size: 15px;"><strong>${event.organizer_name}</strong> just registered a new event${pending ? " — it's waiting on your approval" : " and it's already live"}.</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Event", `<strong>${event.title}</strong>`)}
        ${row("Organizer", event.organizer_name || "Unknown")}
        ${row("Date", event.date || "—")}
        ${row("Venue", [event.venue, event.city].filter(Boolean).join(", ") || "—")}
        ${row("Status", pending ? "Pending review" : "Published (auto-approved)")}
      </table>
      <p style="margin-top: 20px;">
        <a href="${baseUrl}/admin/events" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          ${pending ? "Review Now" : "View in Admin"}
        </a>
      </p>
    `
  );

  const adminResult = await sendMail({
    to: superAdminEmails,
    subject: "New Event Registration",
    html: adminHtml,
    replyTo: superAdminEmails,
  });
  if (!adminResult.sent) {
    logError("event_submitted_email_failed", new Error(adminResult.error || "send failed"), { eventId });
  }

  // Creator confirmation — goes to the email their account is registered
  // with, whether the event is queued for review or already published.
  if (event.organizer_id) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", event.organizer_id).maybeSingle();
    if (profile?.email) {
      const creatorHtml = wrapper(
        "#2563eb",
        "Event Registration Received",
        `
          <p style="font-size: 15px;">We've received your event <strong>${event.title}</strong>.</p>
          <p style="font-size: 15px; margin-top: 8px;">
            ${pending
              ? "It's now in review — we'll email you the moment it's approved and live."
              : "It's already live and on sale. You can track sales from your organizer dashboard."}
          </p>
          <p style="margin-top: 20px;">
            <a href="${baseUrl}/creator/events" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              View My Events
            </a>
          </p>
        `
      );
      const creatorResult = await sendMail({
        to: profile.email,
        subject: `Event registration received — ${event.title}`,
        html: creatorHtml,
        replyTo: superAdminEmails,
      });
      if (!creatorResult.sent) {
        logError("event_submitted_creator_email_failed", new Error(creatorResult.error || "send failed"), { eventId });
      }
    }
  }
}

// Fired when Admin/Super Admin publishes or cancels a pending/existing
// event — the organizer otherwise only finds out by checking My Events.
export async function sendEventStatusEmail(eventId: string, status: "published" | "cancelled"): Promise<void> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("title, organizer_id").eq("id", eventId).maybeSingle();
  if (!event?.organizer_id) return;

  const { data: profile } = await admin.from("profiles").select("email").eq("id", event.organizer_id).maybeSingle();
  if (!profile?.email) return;

  const approved = status === "published";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://eticket.co.zw";
  const html = wrapper(
    approved ? "#16a34a" : "#dc2626",
    approved ? "Event Approved" : "Event Not Approved",
    `
      <p style="font-size: 15px;">
        <strong>${event.title}</strong> ${approved ? "has been approved and is now live." : "was not approved and has been cancelled."}
      </p>
      ${approved ? `<p style="margin-top: 20px;"><a href="${baseUrl}/events/${eventId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Listing</a></p>` : ""}
    `
  );

  const superAdminEmails = await getSuperAdminEmails();
  const result = await sendMail({
    to: profile.email,
    subject: approved ? `Your event "${event.title}" is now live` : `Your event "${event.title}" was not approved`,
    html,
    replyTo: superAdminEmails,
  });
  if (!result.sent) {
    logError("event_status_email_failed", new Error(result.error || "send failed"), { eventId, status });
  }
}
