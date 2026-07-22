import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderServiceProviderBadge } from "@/lib/service-provider-badge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS (organizer-owns-event OR super_admin) gates this select the same
  // way it gates everything else on this table.
  const { data: pass } = await supabase
    .from("service_provider_passes")
    .select("id, full_name, photo_url, company_name, position, events(title, date)")
    .eq("id", id)
    .maybeSingle();

  if (!pass) {
    return NextResponse.json({ error: "Pass not found, or you don't have permission to view it" }, { status: 404 });
  }

  const event = pass.events as unknown as { title: string; date: string } | null;

  const png = await renderServiceProviderBadge({
    id: pass.id,
    fullName: pass.full_name,
    photoUrl: pass.photo_url,
    companyName: pass.company_name,
    position: pass.position,
    eventTitle: event?.title ?? "",
    eventDate: event?.date ?? "",
  });

  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="pass-${pass.full_name.replace(/\s+/g, "-")}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
