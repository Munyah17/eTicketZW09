"use client";

export type AuditAction =
  | "user.create" | "user.delete" | "user.suspend" | "user.activate"
  | "user.role_change" | "user.password_reset"
  | "event.publish" | "event.unpublish" | "event.delete" | "event.markup_change"
  | "payout.approve" | "payout.decline" | "payout.manual"
  | "platform.fee_change" | "platform.feature_toggle" | "platform.announcement"
  | "organizer.verify" | "organizer.suspend"
  | "ticket.manual_issue" | "ticket.refund" | "ticket.void"
  | "admin.login" | "admin.logout";

export interface AuditEntry {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: AuditAction;
  target?: string;
  detail: string;
  ip?: string;
}

const AUDIT_KEY = "eticket_audit_log";
const MAX_ENTRIES = 500;

export function logAuditAction(
  admin: { id: string; name: string; email: string },
  action: AuditAction,
  detail: string,
  target?: string
): void {
  if (typeof window === "undefined") return;
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    adminId: admin.id,
    adminName: admin.name,
    adminEmail: admin.email,
    action,
    target,
    detail,
  };
  const log = getAuditLog();
  log.unshift(entry);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(0, MAX_ENTRIES)));
}

export function getAuditLog(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AUDIT_KEY);
    return stored ? (JSON.parse(stored) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUDIT_KEY);
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  "user.create": "Created user",
  "user.delete": "Deleted user",
  "user.suspend": "Suspended user",
  "user.activate": "Activated user",
  "user.role_change": "Changed user role",
  "user.password_reset": "Reset user password",
  "event.publish": "Published event",
  "event.unpublish": "Unpublished event",
  "event.delete": "Deleted event",
  "event.markup_change": "Changed event markup",
  "payout.approve": "Approved payout",
  "payout.decline": "Declined payout",
  "payout.manual": "Manual payout",
  "platform.fee_change": "Changed platform fee",
  "platform.feature_toggle": "Toggled feature flag",
  "platform.announcement": "Updated announcement",
  "organizer.verify": "Verified organizer",
  "organizer.suspend": "Suspended organizer",
  "ticket.manual_issue": "Manually issued ticket",
  "ticket.refund": "Processed refund",
  "ticket.void": "Voided ticket",
  "admin.login": "Admin login",
  "admin.logout": "Admin logout",
};
