import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public — powers the Contact page form. Logged-in submitters get their
// ticket linked to their account; anonymous visitors can still submit
// (RLS: "Anyone can submit a support ticket").
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, subject, message, type } = body;

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "name, email, subject, and message are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("support_tickets").insert({
    user_id: user?.id ?? null,
    name,
    email,
    subject,
    message,
    type: type ?? "general",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
