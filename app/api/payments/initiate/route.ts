import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PaymentService, PaymentInitiateRequest } from "@/lib/services/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFee, calculateTotalWithFee, calculateBankTransferFee } from "@/lib/pricing";
import { PLATFORM_FEE_PERCENTAGE, PLATFORM_FEE_FIXED, BANK_TRANSFER_FEE_PERCENT, BANK_TRANSFER_FEE_FIXED, PurchasedAddOn } from "@/lib/types";
import { sendFailedPurchaseAlert } from "@/lib/failed-purchase-alert";
import { getSiteUrl } from "@/lib/site-url";
import { createOrder, deleteOrder } from "@/lib/orders";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Re-resolves add-on selections server-side so a tampered client can't claim a
// $0 add-on. Returns validated {addOnId,name,price,quantity} lines and the
// add-on subtotal. Selections over stock are clamped; unknown ids dropped.
async function resolveAddOns(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  raw: unknown
): Promise<{ lines: PurchasedAddOn[]; subtotal: number }> {
  if (!Array.isArray(raw) || raw.length === 0) return { lines: [], subtotal: 0 };
  const { data: addOns } = await supabase
    .from("event_add_ons")
    .select("id, name, price, quantity, sold")
    .eq("event_id", eventId);
  const byId = new Map((addOns ?? []).map((a) => [a.id as string, a]));
  const lines: PurchasedAddOn[] = [];
  for (const sel of raw) {
    const s = sel as { addOnId?: string; quantity?: number };
    const a = s.addOnId ? byId.get(s.addOnId) : undefined;
    if (!a) continue;
    const qty = Math.min(20, Math.max(1, Math.floor(Number(s.quantity)) || 1));
    const stock = a.quantity == null ? Infinity : Number(a.quantity) - Number(a.sold);
    const allowed = Math.max(0, Math.min(qty, stock === Infinity ? qty : stock));
    if (allowed <= 0) continue;
    lines.push({ addOnId: a.id as string, name: a.name as string, price: Number(a.price), quantity: allowed });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  return { lines, subtotal: round2(subtotal) };
}

export async function POST(req: NextRequest) {
  try {
    const body: PaymentInitiateRequest = await req.json();
    body.origin = getSiteUrl(req);

    // The checkout form carries the purchase identity inside metadata
    // (camelCase) â€” normalize it up to the top-level fields the repricing
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

    if (!["paynow", "ecocash", "bank_transfer"].includes(body.provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'paynow', 'ecocash', or 'bank_transfer'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: platformConfig } = await supabase.from("platform_config").select("*").eq("id", 1).single();

    if (platformConfig && !platformConfig.online_payments) {
      return NextResponse.json({ error: "Online payments are currently disabled" }, { status: 503 });
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
    // verbatim â€” a tampered request could undercharge itself or zero the
    // fee. Recompute both server-side from the ticket type's real price and
    // the live platform_config rates (percent + fixed).
    // orderId/orderReference are hoisted so the failure path below can delete a
    // split order that was created but whose payment never initiated.
    let orderId: string | null = null;
    let orderReference: string | null = null;
    if (body.ticket_type_id) {
      const quantity = Math.min(10, Math.max(1, Math.floor(Number(body.metadata?.quantity)) || 1));
      const { data: ticketType } = await supabase
        .from("ticket_types")
        .select("price, currency, event_id, custom_charge_fixed, custom_charge_percent, custom_markup_fixed, custom_markup_percent")
        .eq("id", body.ticket_type_id)
        .maybeSingle();

      if (!ticketType) {
        return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
      }

      // Only published events are on sale — a crafted request must not be able
      // to buy tickets to a draft/pending/cancelled/completed event by id.
      const { data: evt } = await supabase
        .from("events")
        .select("status, allow_split_payment, split_deposit_percent, split_installment_count")
        .eq("id", ticketType.event_id)
        .maybeSingle();
      if (!evt || evt.status !== "published") {
        return NextResponse.json({ error: "This event is not on sale" }, { status: 400 });
      }

      // Per-class custom charge + markup (admin/super-admin set) folds into the
      // per-ticket price before the platform fee is applied.
      const basePrice = Number(ticketType.price);
      const perTicketExtra = round2(
        (Number(ticketType.custom_charge_fixed) || 0) +
        (Number(ticketType.custom_markup_fixed) || 0) +
        (((Number(ticketType.custom_charge_percent) || 0) + (Number(ticketType.custom_markup_percent) || 0)) * basePrice) / 100
      );
      const effectivePrice = round2(basePrice + perTicketExtra);

      // Add-ons are re-priced server-side; the client only sends ids + qty.
      const { lines: addOnLines, subtotal: addOnSubtotal } = await resolveAddOns(
        supabase,
        ticketType.event_id,
        body.metadata?.addOns
      );

      const ticketSubtotal = round2(effectivePrice * quantity);
      const subtotal = round2(ticketSubtotal + addOnSubtotal);
      const feePercent = Number(platformConfig?.service_fee_percent ?? PLATFORM_FEE_PERCENTAGE);
      const feeFixed = Number(platformConfig?.service_fee_fixed ?? PLATFORM_FEE_FIXED);
      const fee = calculatePlatformFee(subtotal, feePercent, feeFixed);

      let orderTotal = calculateTotalWithFee(subtotal, feePercent, feeFixed);
      // Bank deposits cost the platform a transaction fee â€” passed to the buyer.
      const bankTransferFee =
        body.provider === "bank_transfer"
          ? calculateBankTransferFee(orderTotal, BANK_TRANSFER_FEE_PERCENT, BANK_TRANSFER_FEE_FIXED)
          : 0;
      orderTotal = round2(orderTotal + bankTransferFee);

      // admitCount flows straight into the ticket row and the gate — clamp it
      // so a crafted request can't mint a ticket that admits an absurd crowd.
      const rawAdmit = Number(body.metadata?.admitCount);
      const admitCount = Number.isFinite(rawAdmit) && rawAdmit > 0 ? Math.min(50, Math.floor(rawAdmit)) : 1;

      // Resolved purchase metadata — server-priced fee, clamped admitCount and
      // validated add-ons. This exact object is what fulfillment reads, and it
      // is also snapshotted onto the order so a later installment can mint the
      // tickets even though that payment carries no buyer form.
      const resolvedMetadata: Record<string, unknown> = {
        ...(body.metadata ?? {}),
        quantity,
        platformFeeAmount: fee,
        bankTransferFee,
        // Fulfillment reads eventId/ticketTypeId from metadata — pin them to
        // the repriced ticket type so a cheap top-level id can't be paired
        // with an expensive metadata id (price arbitrage).
        ticketTypeId: body.ticket_type_id,
        eventId: ticketType.event_id,
        admitCount,
        addOns: addOnLines,
      };

      // Split payments: when the event allows it and the buyer opted in, charge
      // only the deposit now and open an order for the balance. Tickets are
      // issued by fulfillment only once the order is fully settled.
      const wantsSplit = !!body.metadata?.splitPayment && !!evt.allow_split_payment;
      let chargeAmount = orderTotal;
      if (wantsSplit) {
        const depositPct = Math.min(90, Math.max(10, Number(evt.split_deposit_percent) || 30));
        chargeAmount = round2(orderTotal * (depositPct / 100));
        // Never let the deposit equal the full total (that defeats the point)
        // or drop below a sensible floor.
        if (chargeAmount >= orderTotal) chargeAmount = round2(orderTotal - 0.01);
        if (chargeAmount <= 0) chargeAmount = round2(orderTotal * 0.1);

        orderReference = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
        const order = await createOrder({
          reference: orderReference,
          eventId: ticketType.event_id,
          ticketTypeId: body.ticket_type_id,
          quantity,
          buyerName: (body.metadata?.buyerName as string) || "Guest",
          buyerEmail: (body.metadata?.buyerEmail as string) || "",
          buyerPhone: (body.metadata?.buyerPhone as string) || undefined,
          customFieldResponses: body.metadata?.customFieldResponses as Record<string, string> | undefined,
          addOns: addOnLines,
          purchaseMetadata: resolvedMetadata,
          subtotal,
          fees: round2(fee + bankTransferFee),
          total: orderTotal,
          depositPercent: depositPct,
          installmentCount: Math.max(1, Math.floor(Number(evt.split_installment_count)) || 2),
        });
        if (!order) {
          return NextResponse.json({ error: "Could not create payment plan" }, { status: 500 });
        }
        orderId = order.id;
      }

      body.amount = chargeAmount;
      body.currency = ticketType.currency;
      body.event_id = ticketType.event_id;
      body.metadata = {
        ...resolvedMetadata,
        orderTotal: wantsSplit ? orderTotal : undefined,
        orderId: orderId ?? undefined,
        orderReference: orderReference ?? undefined,
        paymentKind: wantsSplit ? "deposit" : "full",
      };
    }

    let result;
    try {
      result = await PaymentService.initiatePayment(body);
    } catch (initErr) {
      // Gateway threw — remove the split order we just created so it doesn't
      // linger as a "pending, $0 paid" row the buyer could trip over later.
      if (orderId) await deleteOrder(orderId).catch(() => {});
      throw initErr;
    }

    if (!result.success) {
      if (orderId) await deleteOrder(orderId).catch(() => {});
      // A ticket purchase that can't even initiate is a lost sale â€” alert
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
