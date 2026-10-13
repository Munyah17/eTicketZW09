import { logError } from "@/lib/error-logger";
import { sendMail } from "@/lib/email/mailer";
import { wrapper, row } from "@/lib/email/html";
import { getSuperAdminEmails } from "@/lib/email/recipients";

export interface SignupNotificationInput {
  email: string;
  name?: string;
  role?: string;
  success: boolean;
  reason?: string;
}

// Admin-facing signup alerts — both halves of registration:
//   success → fired by the GoTrue after_user_created hook (server-side
//             guaranteed, catches every channel: self-serve, admin-created)
//   failure → fired by the register page when GoTrue rejects the signup
// Goes to the super admins; the ops inbox mirror covers the record copy.
export async function sendSignupNotification(input: SignupNotificationInput): Promise<void> {
  const superAdminEmails = await getSuperAdminEmails();
  const accent = input.success ? "#059669" : "#dc2626";

  const html = wrapper(
    accent,
    input.success ? "New Account Registered" : "Signup Failed",
    `
      <p style="font-size: 15px;">
        ${input.success
          ? `Someone just created an account${input.role === "organizer" ? " to <strong>sell tickets</strong>" : ""}.`
          : `A signup attempt was rejected by the auth server.`}
      </p>
      <table style="width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse;">
        ${row("Email", `<strong>${input.email}</strong>`)}
        ${input.name ? row("Name", input.name) : ""}
        ${input.role ? row("Account type", input.role === "organizer" ? "Organizer" : "Customer") : ""}
        ${!input.success && input.reason ? row("Reason", input.reason) : ""}
      </table>
    `
  );

  const result = await sendMail({
    to: [...new Set([...superAdminEmails, "sales@eticket.co.zw"])],
    subject: input.success ? `New signup — ${input.email}` : `Signup failed — ${input.email}`,
    html,
    replyTo: superAdminEmails,
  });
  if (!result.sent) {
    logError("signup_notification_failed", new Error(result.error || "send failed"), { email: input.email });
  }
}
