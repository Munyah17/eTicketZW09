// Display labels/categories for the real, server-side audit trail
// (audit_logs table, written via lib/server-audit-log.ts). This module used
// to also read/write a client-only localStorage log — that never left the
// admin's own browser, so it's gone; every write now goes through logAudit()
// on the server.
export type AuditAction =
  | "user.create" | "user.delete" | "user.suspend" | "user.activate"
  | "user.role_change" | "user.password_reset"
  | "staff.create" | "staff.update" | "staff.remove"
  | "event.publish" | "event.unpublish" | "event.delete" | "event.markup_change"
  | "payout.approve" | "payout.decline" | "payout.manual"
  | "platform.fee_change" | "platform.feature_toggle" | "platform.announcement"
  | "organizer.verify" | "organizer.suspend"
  | "ticket.manual_issue" | "ticket.refund" | "ticket.void"
  | "banner.upload" | "banner.update" | "banner.clear"
  | "support.status_change"
  | "payment.manual_confirm" | "payment.manual_decline"
  | "admin.login" | "admin.logout";

export const ACTION_LABELS: Record<AuditAction, string> = {
  "user.create": "Created user",
  "user.delete": "Deleted user",
  "user.suspend": "Suspended user",
  "user.activate": "Activated user",
  "user.role_change": "Changed user role",
  "user.password_reset": "Reset user password",
  "staff.create": "Added admin staff",
  "staff.update": "Updated admin staff",
  "staff.remove": "Removed admin staff",
  "event.publish": "Published event",
  "event.unpublish": "Unpublished event",
  "event.delete": "Deleted event",
  "event.markup_change": "Changed event markup",
  "payout.approve": "Approved payout",
  "payout.decline": "Declined payout",
  "payout.manual": "Manual payout",
  "platform.fee_change": "Changed platform config",
  "platform.feature_toggle": "Toggled feature flag",
  "platform.announcement": "Updated announcement",
  "organizer.verify": "Verified organizer",
  "organizer.suspend": "Suspended organizer",
  "ticket.manual_issue": "Manually issued ticket",
  "ticket.refund": "Processed refund",
  "ticket.void": "Voided ticket",
  "banner.upload": "Uploaded banner",
  "banner.update": "Updated banner",
  "banner.clear": "Cleared banner slot",
  "support.status_change": "Updated support ticket",
  "payment.manual_confirm": "Manually confirmed payment",
  "payment.manual_decline": "Manually declined payment",
  "admin.login": "Admin login",
  "admin.logout": "Admin logout",
};

export const ACTION_CATEGORY: Record<string, string> = {
  "user.": "User",
  "staff.": "Staff",
  "event.": "Event",
  "payout.": "Financial",
  "payment.": "Financial",
  "platform.": "Platform",
  "organizer.": "Organizer",
  "ticket.": "Ticket",
  "banner.": "Banner",
  "support.": "Support",
  "admin.": "Auth",
};

export function getAuditCategory(action: string): string {
  for (const prefix in ACTION_CATEGORY) {
    if (action.startsWith(prefix)) return ACTION_CATEGORY[prefix];
  }
  return "Other";
}
