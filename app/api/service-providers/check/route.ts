import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation";

// Public, read-only pass verification — the page a phone camera lands on
// when scanning the QR printed on a service provider badge. This is the
// entire point of the QR: anyone (gate staff, a suspicious bystander) can
// confirm a badge is genuine and not a printed forgery or a shared/expired
// one, without needing an account. Never mutates anything.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";
  if (!code || !isUuid(code)) {
    return NextResponse.json({ status: "invalid", message: "Invalid credential code." });
  }

  const admin = createAdminClient();
  const { data: pass } = await admin
    .from("service_provider_passes")
    .select("id, full_name, photo_url, company_name, position, revoked, revoked_at, created_at, events(title, date)")
    .eq("id", code)
    .maybeSingle();

  if (!pass) {
    return NextResponse.json({ status: "invalid", message: "No credential found for this code." });
  }

  const event = pass.events as unknown as { title: string; date: string } | null;

  if (pass.revoked) {
    return NextResponse.json({
      status: "revoked",
      message: `This credential was revoked on ${new Date(pass.revoked_at!).toLocaleDateString()}.`,
      pass: {
        fullName: pass.full_name,
        photoUrl: pass.photo_url,
        companyName: pass.company_name,
        position: pass.position,
        eventTitle: event?.title ?? "",
      },
    });
  }

  return NextResponse.json({
    status: "valid",
    message: "Genuine service provider credential.",
    pass: {
      fullName: pass.full_name,
      photoUrl: pass.photo_url,
      companyName: pass.company_name,
      position: pass.position,
      eventTitle: event?.title ?? "",
      eventDate: event?.date ?? "",
      issuedAt: pass.created_at,
    },
  });
}
