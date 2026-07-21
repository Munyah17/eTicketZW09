import { NextRequest, NextResponse } from "next/server";
import { PaymentService, PaymentInitiateRequest } from "@/lib/services/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body: PaymentInitiateRequest = await req.json();
    body.origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!body.product_name || !body.amount || !body.currency || !body.provider) {
      return NextResponse.json(
        { error: "Missing required fields: product_name, amount, currency, provider" },
        { status: 400 }
      );
    }

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!["paynow", "stripe", "ecocash"].includes(body.provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'paynow', 'stripe', or 'ecocash'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: platformConfig } = await supabase.from("platform_config").select("*").eq("id", 1).single();

    if (platformConfig && !platformConfig.online_payments) {
      return NextResponse.json({ error: "Online payments are currently disabled" }, { status: 503 });
    }
    if (platformConfig && body.provider === "stripe" && !platformConfig.stripe_enabled) {
      return NextResponse.json({ error: "Card payments are currently disabled" }, { status: 503 });
    }
    if (platformConfig && body.provider === "paynow" && !platformConfig.paynow_enabled) {
      return NextResponse.json({ error: "Paynow payments are currently disabled" }, { status: 503 });
    }
    if (platformConfig && body.provider === "ecocash" && !platformConfig.ecocash_enabled) {
      return NextResponse.json({ error: "EcoCash payments are currently disabled" }, { status: 503 });
    }

    const result = await PaymentService.initiatePayment(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment initiation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: result.reference,
      redirect_url: result.redirect_url,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
