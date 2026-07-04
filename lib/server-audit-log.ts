import { createAdminClient } from "@/lib/supabase/admin";

// Real, server-side audit trail backed by the audit_logs table — replaces
// the old client-only localStorage logger, which never left the admin's own
// browser and was invisible to everyone else running the platform.
export async function logAudit(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    details: params.details ?? {},
  });
}
