import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server-audit-log";

// Service Provider passes are scoped narrower than the usual admin-or-
// super-admin pairing used elsewhere: only Super Admin, or the organizer
// who owns the specific event, can issue or manage them. Regular Admin
// accounts are deliberately excluded.
async function requireEventAccess(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "super_admin") {
    return { authed: true, userId: user.id, userEmail: user.email ?? "", supabase } as const;
  }

  const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single();
  if (!event || event.organizer_id !== user.id) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — you can only issue service provider passes for your own events" },
        { status: 403 }
      ),
    } as const;
  }
  return { authed: true, userId: user.id, userEmail: user.email ?? "", supabase } as const;
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const auth = await requireEventAccess(eventId);
  if ("error" in auth) return auth.error;

  // RLS backs this up independently — the explicit check above just gives a
  // clearer error message than a bare empty result would.
  const { data, error } = await auth.supabase
    .from("service_provider_passes")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const eventId = form.get("eventId") as string | null;
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const auth = await requireEventAccess(eventId);
  if ("error" in auth) return auth.error;

  const fullName = (form.get("fullName") as string | null)?.trim();
  const companyName = (form.get("companyName") as string | null)?.trim();
  const position = (form.get("position") as string | null)?.trim();
  if (!fullName || !companyName || !position) {
    return NextResponse.json({ error: "Full name, company name, and position are all required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let photoUrl = "";
  const photo = form.get("photo") as File | null;
  if (photo && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json({ error: "Photo must be an image file" }, { status: 400 });
    }
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `sp-photo-${eventId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("events")
      .upload(path, buffer, { contentType: photo.type, upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const { data: pub } = admin.storage.from("events").getPublicUrl(path);
    photoUrl = pub.publicUrl;
  }

  const { data: created, error } = await auth.supabase
    .from("service_provider_passes")
    .insert({
      event_id: eventId,
      issued_by: auth.userId,
      full_name: fullName,
      company_name: companyName,
      position,
      photo_url: photoUrl,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: auth.userId,
    actorEmail: auth.userEmail,
    action: "service_provider_pass.create",
    resourceType: "service_provider_pass",
    resourceId: created.id,
    details: { eventId, fullName, companyName, position },
  });

  return NextResponse.json({ pass: created });
}
