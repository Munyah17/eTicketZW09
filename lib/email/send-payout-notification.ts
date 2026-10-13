import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { formatMoney, wrapper, row } from "@/lib/email/html";

const OPS_INBOX = process.env.NOTIFICATIONS_INBOX || "notifications@globalspaceweb.co.zw";

interface PayoutInfo {
  id: string;
  organizerId: string;
  organizerName: string;
  amount: number;
  paymentMethod: string;
}

// Fired right after an organizer submits a payout request — lets Admin know
// there's something to review without having to keep checking the dashboard.
export async function sendPayoutSubmittedEmail(payout: PayoutInfo): Promise<void> {
  const html = wrapper(
    "#0f172a",
    "New Payout Request",
    `
      <p style="font-size: 14px; color: #64748b;"><strong>${payout.organizerName}</strong> has requested a payout.</p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Amount", formatMoney(payout.amount))}
        ${row("Method", payout.paymentMethod)}
        ${row("Request ID", `<span style="font-family: monospace;">${payout.id}</span>`)}
      </table>
      <p style="font-size: 13px; color: #64748b; margin-top: 16px;">Review it from Admin → Payout Requests.</p>
    `
  );

  const result = await sendMail({ to: OPS_INBOX, subject: `Payout requested — ${payout.organizerName}`, html });
  if (!result.sent) {
    logError("payout_submitted_email_failed", new Error(result.error || "send failed"), { payoutId: payout.id });
  }
}

// Fired when Admin approves or declines a payout request — the organizer
// otherwise has no way to know except polling their own dashboard.
export async function sendPayoutStatusEmail(
  payoutId: string,
  status: "approved" | "declined",
  declineReason?: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payout_requests")
    .select("organizer_id, organizer_name, amount")
    .eq("id", payoutId)
    .maybeSingle();
  if (!payout) return;

  const { data: organizer } = await admin.from("organizers").select("user_id").eq("id", payout.organizer_id).maybeSingle();
  if (!organizer?.user_id) return;

  const { data: profile } = await admin.from("profiles").select("email").eq("id", organizer.user_id).maybeSingle();
  if (!profile?.email) return;

  const approved = status === "approved";
  const html = wrapper(
    approved ? "#16a34a" : "#dc2626",
    approved ? "Payout Approved" : "Payout Declined",
    `
      <p style="font-size: 15px;">
        Your payout request for <strong>${formatMoney(Number(payout.amount))}</strong> has been
        ${approved ? "approved and is on its way to you." : "declined."}
      </p>
      ${declineReason ? `<p style="font-size: 14px; color: #64748b; margin-top: 8px;"><strong>Reason:</strong> ${declineReason}</p>` : ""}
    `
  );

  const result = await sendMail({
    to: profile.email,
    subject: approved ? "Your payout has been approved" : "Your payout request was declined",
    html,
  });
  if (!result.sent) {
    logError("payout_status_email_failed", new Error(result.error || "send failed"), { payoutId, status });
  }
}
