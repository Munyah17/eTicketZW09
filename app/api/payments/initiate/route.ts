import { NextRequest, NextResponse } from "next/server";
import { PaymentService, PaymentInitiateRequest } from "@/lib/services/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFee, calculateTotalWithFee, calculateBankTransferFee } from "@/lib/pricing";
import { PLATFORM_FEE_PERCENTAGE, PLATFORM_FEE_FIXED, BANK_TRANSFER_FEE_PERCENT, BANK_TRANSFER_FEE_FIXED } from "@/lib/types";
import { sendFailedPurchaseAlert } from "@/lib/failed-purchase-alert";
import { getSiteUrl } from "@/lib/site-url";

export async function POST(req: NextRequest) {
  try {
    const body: PaymentInitiateRequest = await req.json();
    body.origin = getSiteUrl(req);

    // The checkout form carries the purchase identity inside metadata
    // (camelCase) — normalize it up to the top-level fields the repricing
    // and column writes below key on. Without this, every purchase
    // silently skipped price verification and left payments.event_id /
    // payments.ticket_type_id NULL.
    const meta = (body.metadata ?? {}) as Record<string, unknown>;
    body.ticket_type_id = body.ticket_type_id ?? (meta.ticketTypeId as string | undefined);
    body.event_id = body.event_id ?? (meta.eventId as string | undefined);

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

    if (!["paynow", "stripe", "ecocash", "bank_transfer"].includes(body.provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'paynow', 'stripe', 'ecocash', or 'bank_transfer'" },
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
    if (platformConfig && body.provider === "bank_transfer" && platformConfig.bank_transfer_enabled === false) {
      return NextResponse.json({ error: "Bank transfer payments are currently disabled" }, { status: 503 });
    }

    // Never trust the browser for money math. The amount charged and the
    // platform fee recorded in metadata both used to arrive from the client
    // verbatim — a tampered request could undercharge itself or zero the
    // fee. Recompute both server-side from the ticket type's real price and
    // the live platform_config rates (percent + fixed).
    if (body.ticket_type_id) {
      const quantity = Math.min(10, Math.max(1, Math.floor(Number(body.metadata?.quantity)) || 1));
      const { data: ticketType } = await supabase
        .from("ticket_types")
        .select("price, currency, event_id")
        .eq("id", body.ticket_type_id)
        .maybeSingle();

      if (!ticketType) {
        return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
      }

      const subtotal = Number(ticketType.price) * quantity;
      const feePercent = Number(platformConfig?.service_fee_percent ?? PLATFORM_FEE_PERCENTAGE);
      const feeFixed = Number(platformConfig?.service_fee_fixed ?? PLATFORM_FEE_FIXED);
      const fee = calculatePlatformFee(subtotal, feePercent, feeFixed);

      let total = calculateTotalWithFee(subtotal, feePercent, feeFixed);
      // Bank deposits cost the platform a transaction fee — passed to the buyer.
      const bankTransferFee =
        body.provider === "bank_transfer"
          ? calculateBankTransferFee(total, BANK_TRANSFER_FEE_PERCENT, BANK_TRANSFER_FEE_FIXED)
          : 0;
      total += bankTransferFee;

      body.amount = total;
      body.currency = ticketType.currency;
      body.event_id = body.event_id ?? ticketType.event_id;
      body.metadata = {
        ...(body.metadata ?? {}),
        quantity,
        platformFeeAmount: fee,
        bankTransferFee,
      };
    }

    const result = await PaymentService.initiatePayment(body);

    if (!result.success) {
      // A ticket purchase that can't even initiate is a lost sale — alert
      // the super admins (email + SMS) so a gateway outage or bad config
      // is never discovered days later from missing revenue.
      if (body.ticket_type_id) {
        sendFailedPurchaseAlert({
          reference: result.reference,
          eventTitle: body.metadata?.eventTitle as string | undefined,
          buyerEmail: body.metadata?.buyerEmail as string | undefined,
          buyerPhone: body.metadata?.buyerPhone as string | undefined,
          provider: body.provider,
          amount: body.amount,
          currency: body.currency,
          reason: result.error || "Payment initiation failed",
          stage: "initiation",
        }).catch(() => {});
      }
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
