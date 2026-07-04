import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOwnOrganizerId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
  if (!organizer) return { error: NextResponse.json({ error: "No organizer profile found" }, { status: 404 }) } as const;

  return { organizerId: organizer.id } as const;
}

export async function GET() {
  const supabase = await createClient();
  const scoped = await getOwnOrganizerId(supabase);
  if ("error" in scoped) return scoped.error;

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("organizer_id", scoped.organizerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const scoped = await getOwnOrganizerId(supabase);
  if ("error" in scoped) return scoped.error;

  const body = await req.json();
  const { name, email, phone, role, assignedEvents } = body;
  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email, and role are required" }, { status: 400 });
  }

  const { error } = await supabase.from("staff_members").insert({
    organizer_id: scoped.organizerId,
    name,
    email,
    phone: phone ?? "",
    role,
    assigned_events: assignedEvents ?? [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const scoped = await getOwnOrganizerId(supabase);
  if ("error" in scoped) return scoped.error;

  const body = await req.json();
  const { staffId, name, email, phone, role, assignedEvents, isActive } = body;
  if (!staffId) return NextResponse.json({ error: "staffId is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (role !== undefined) updates.role = role;
  if (assignedEvents !== undefined) updates.assigned_events = assignedEvents;
  if (isActive !== undefined) updates.is_active = isActive;

  const { error } = await supabase
    .from("staff_members")
    .update(updates)
    .eq("id", staffId)
    .eq("organizer_id", scoped.organizerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const scoped = await getOwnOrganizerId(supabase);
  if ("error" in scoped) return scoped.error;

  const body = await req.json();
  const { staffId } = body;
  if (!staffId) return NextResponse.json({ error: "staffId is required" }, { status: 400 });

  const { error } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffId)
    .eq("organizer_id", scoped.organizerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
