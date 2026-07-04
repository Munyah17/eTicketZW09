import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve actor names in one extra query rather than N+1.
  const actorIds = [...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", actorIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return NextResponse.json({
    entries: (data ?? []).map((e) => ({
      ...e,
      actor_name: e.actor_id ? nameById.get(e.actor_id) ?? e.actor_email : "System",
    })),
  });
}
