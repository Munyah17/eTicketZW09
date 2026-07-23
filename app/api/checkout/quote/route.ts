import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFee, calculateTotalWithFee } from "@/lib/pricing";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/types";

// Computes the buyer-facing processing fee server-side and returns only the
// resulting dollar amounts — never the rate itself. The rate is a trade
// secret (see memory: eticketzw-fee-secrecy); this endpoint exists so
// checkout never has to fetch service_fee_percent directly, which would put
// it in a network response any buyer's browser could inspect.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const subtotal = Number(body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ error: "subtotal must be a non-negative number" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: config } = await supabase
    .from("platform_config")
    .select("service_fee_percent")
    .eq("id", 1)
    .maybeSingle();

  const feePercent = Number(config?.service_fee_percent ?? PLATFORM_FEE_PERCENTAGE);

  return NextResponse.json({
    fee: calculatePlatformFee(subtotal, feePercent),
    total: calculateTotalWithFee(subtotal, feePercent),
  });
}
