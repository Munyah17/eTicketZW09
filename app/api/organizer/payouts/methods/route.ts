import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user is super admin for technical support access
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isSuperAdmin = profile?.role === "super_admin";

  // Super admin can view any organizer's payout methods via ?organizerId=xxx query param
  const url = new URL(req.url);
  const queryOrganizerId = url.searchParams.get("organizerId");

  let organizerId: string;
  if (isSuperAdmin && queryOrganizerId) {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("id", queryOrganizerId).maybeSingle();
    if (!organizer) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
    organizerId = organizer.id;
  } else {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
    if (!organizer) return NextResponse.json({ error: "No organizer profile found" }, { status: 404 });
    organizerId = organizer.id;
  }

  const { data: methods } = await supabase
    .from("organizer_payout_methods")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ methods: methods ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user is super admin for technical support access
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isSuperAdmin = profile?.role === "super_admin";

  // Super admin can add payout methods for any organizer via ?organizerId=xxx query param
  const url = new URL(req.url);
  const queryOrganizerId = url.searchParams.get("organizerId");

  let organizerId: string;
  if (isSuperAdmin && queryOrganizerId) {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("id", queryOrganizerId).maybeSingle();
    if (!organizer) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
    organizerId = organizer.id;
  } else {
    const { data: organizer } = await supabase.from("organizers").select("id").eq("user_id", user.id).single();
    if (!organizer) return NextResponse.json({ error: "No organizer profile found" }, { status: 404 });
    organizerId = organizer.id;
  }

  const body = await req.json();
  const { label, paymentMethod, paymentDetails } = body;

  if (!label || !paymentMethod || !paymentDetails) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check if organizer already has 5 methods
  const { data: existingMethods } = await supabase
    .from("organizer_payout_methods")
    .select("id", { count: "exact" })
    .eq("organizer_id", organizerId);

  if (existingMethods && existingMethods.length >= 5) {
    return NextResponse.json({ error: "Maximum of 5 payout methods allowed per organizer" }, { status: 400 });
  }

  const { error } = await supabase.from("organizer_payout_methods").insert({
    organizer_id: organizerId,
    label,
    payment_method: paymentMethod,
    payment_details: paymentDetails,
    is_default: existingMethods && existingMethods.length === 0,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
