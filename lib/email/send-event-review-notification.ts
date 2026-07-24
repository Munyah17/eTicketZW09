import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper } from "@/lib/email/html";

const SALES_INBOX = "sales@eticket.co.zw";

// Fired when an event lands in pending_review (auto-approve is off) — lets
// Admin know there's a listing waiting on them instead of relying on
// someone happening to check the Events & Markups page.
export async function sendEventSubmittedEmail(eventId: string, title: string, organizerName: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://eticket.co.zw";
  const html = wrapper(
    "#0f172a",
    "Event Pending Review",
    `
      <p style="font-size: 15px;"><strong>${organizerName}</strong> submitted an event that needs approval before it goes live.</p>
      <p style="font-size: 15px; margin-top: 8px;"><strong>${title}</strong></p>
      <p style="margin-top: 20px;">
        <a href="${baseUrl}/admin/events" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Review Now
        </a>
      </p>
    `
  );

  const result = await sendMail({ to: SALES_INBOX, subject: `Event pending review — ${title}`, html });
  if (!result.sent) {
    logError("event_submitted_email_failed", new Error(result.error || "send failed"), { eventId });
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

  const result = await sendMail({
    to: profile.email,
    subject: approved ? `Your event "${event.title}" is now live` : `Your event "${event.title}" was not approved`,
    html,
  });
  if (!result.sent) {
    logError("event_status_email_failed", new Error(result.error || "send failed"), { eventId, status });
  }
}
