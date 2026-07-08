import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { logAudit } from "@/lib/server-audit-log";

// Plug-and-play banner control: upload/replace an image (and optional title
// and destination link) for a fixed ad slot, or clear it back to "available".
// Takes effect immediately — the public /api/banners endpoint (used by the
// homepage) reads straight from this table, no redeploy needed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const form = await req.formData();
  const clear = form.get("clear") === "true";

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("banners").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Banner slot not found" }, { status: 404 });

  if (clear) {
    const { error } = await supabase
      .from("banners")
      .update({ image: null, link: null, title: null, status: "available", impressions: 0 })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "banner.clear",
      resourceType: "banner",
      resourceId: id,
      details: { type: existing.type, position: existing.position },
    });

    return NextResponse.json({ success: true });
  }

  const updates: Record<string, unknown> = {};
  const title = form.get("title");
  const link = form.get("link");
  if (title !== null) updates.title = String(title);
  if (link !== null) updates.link = String(link);

  const file = form.get("image") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${existing.type}-${existing.position}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
    updates.image = pub.publicUrl;
    // Reset impressions when image is replaced
    updates.impressions = 0;
  }

  // A slot is "active" once it has an image; otherwise it's still just available.
  if (updates.image || existing.image) updates.status = "active";

  const { error } = await supabase.from("banners").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: file ? "banner.upload" : "banner.update",
    resourceType: "banner",
    resourceId: id,
    details: { type: existing.type, position: existing.position, title: updates.title, link: updates.link },
  });

  return NextResponse.json({ success: true });
}
