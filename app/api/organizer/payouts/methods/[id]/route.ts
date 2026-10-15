import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user is super admin for technical support access
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isSuperAdmin = profile?.role === "super_admin";

  const body = await req.json();
  const { label, paymentMethod, paymentDetails } = body;

  if (!label || !paymentMethod || !paymentDetails) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the method exists and get its organizer_id
  const { data: method } = await supabase
    .from("organizer_payout_methods")
    .select("id, organizer_id")
    .eq("id", id)
    .maybeSingle();

  if (!method) {
    return NextResponse.json({ error: "Method not found" }, { status: 404 });
  }

  // Verify ownership for regular organizers
  if (!isSuperAdmin) {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
    if (!organizer || method.organizer_id !== organizer.id) {
      return NextResponse.json({ error: "Method not found" }, { status: 404 });
    }
  }

  const { error } = await supabase
    .from("organizer_payout_methods")
    .update({
      label,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user is super admin for technical support access
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isSuperAdmin = profile?.role === "super_admin";

  // Verify the method exists and get its organizer_id
  const { data: method } = await supabase
    .from("organizer_payout_methods")
    .select("id, organizer_id")
    .eq("id", id)
    .maybeSingle();

  if (!method) {
    return NextResponse.json({ error: "Method not found" }, { status: 404 });
  }

  // Verify ownership for regular organizers
  if (!isSuperAdmin) {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
    if (!organizer || method.organizer_id !== organizer.id) {
      return NextResponse.json({ error: "Method not found" }, { status: 404 });
    }
  }

  const { error } = await supabase.from("organizer_payout_methods").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
