import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/server-audit-log";

// Revokes a pass — kept as a record (not hard-deleted) so a scan of a
// revoked badge can still tell staff "this was valid, now revoked" rather
// than "not found", which reads as a possible forgery instead of a
// deliberately withdrawn credential.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS (organizer-owns-event OR super_admin) gates the update itself —
  // .eq("id", ...) with .select() tells us whether it actually matched.
  const { data: updated, error } = await supabase
    .from("service_provider_passes")
    .update({ revoked: true, revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json({ error: "Pass not found, or you don't have permission to revoke it" }, { status: 404 });
  }

  await logAudit({
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "service_provider_pass.revoke",
    resourceType: "service_provider_pass",
    resourceId: id,
  });

  return NextResponse.json({ success: true });
}
