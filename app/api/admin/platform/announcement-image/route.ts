import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Uploads (or clears) the image for the announcement banner's "ad" mode —
// reuses the same "banners" storage bucket the hero/section ad slots use.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const form = await req.formData();
  const clear = form.get("clear") === "true";
  const supabase = createAdminClient();

  if (clear) {
    const { error } = await supabase.from("platform_config").update({ announcement_image: null }).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const file = form.get("image") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `announcement-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("banners")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);

  const { data, error } = await supabase
    .from("platform_config")
    .update({ announcement_image: pub.publicUrl, updated_by: auth.user.id })
    .eq("id", 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "platform.announcement",
    resourceType: "platform_config",
    resourceId: "1",
    details: { image: pub.publicUrl },
  });

  return NextResponse.json({ config: data });
}
