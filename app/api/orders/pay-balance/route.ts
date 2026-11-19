import { NextRequest, NextResponse } from "next/server";
import { PaymentService, PaymentInitiateRequest } from "@/lib/services/payment-service";
import { getOrderByReference } from "@/lib/orders";
import { getSiteUrl } from "@/lib/site-url";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/orders/pay-balance?reference=ORD-XXX&email=buyer@x.com
// Returns the order's settlement status so the pay-balance page can show the
// outstanding balance before the buyer chooses an amount + provider.
export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get("reference") || "";
    const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
    if (!reference || !email) {
      return NextResponse.json({ error: "reference and email are required" }, { status: 400 });
    }
    const order = await getOrderByReference(reference);
    if (!order || order.buyer_email.toLowerCase() !== email) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({
      reference: order.reference,
      status: order.status,
      total: Number(order.total),
      amountPaid: Number(order.amount_paid),
      balance: Number(order.balance),
      quantity: order.quantity,
      paymentPlan: order.payment_plan,
    });
  } catch (err) {
    console.error("pay-balance lookup error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// POST /api/orders/pay-balance
// Settles (part of) a split-payment order's remaining balance. The buyer picks
// an amount up to the outstanding balance and any supported provider — each
// successful payment reduces the balance, and tickets are issued automatically
// once it reaches zero (see PaymentService.confirmPaid order handling).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderReference = String(body.orderReference || "").trim();
    const buyerEmail = String(body.buyerEmail || "").trim().toLowerCase();
    const provider = String(body.provider || "");
    const requestedAmount = Number(body.amount);

    if (!orderReference || !buyerEmail) {
      return NextResponse.json({ error: "Order reference and buyer email are required" }, { status: 400 });
    }
    if (!["paynow", "ecocash", "bank_transfer"].includes(provider)) {
      return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
    }

    const order = await getOrderByReference(orderReference);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    // The email must match the order's buyer — the reference alone shouldn't
    // let a stranger settle (or probe) someone else's plan.
    if (order.buyer_email.toLowerCase() !== buyerEmail) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status === "paid" || order.status === "cancelled") {
      return NextResponse.json({ error: "This order is already settled" }, { status: 400 });
    }

    const balance = round2(Number(order.balance));
    if (balance <= 0) {
      return NextResponse.json({ error: "This order has no outstanding balance" }, { status: 400 });
    }

    // Amount defaults to the full balance; the buyer may pay a smaller part.
    // Clamp to (0, balance] and a $1 floor to avoid dust payments.
    let amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? round2(requestedAmount) : balance;
    if (amount > balance) amount = balance;
    if (amount < 1) {
      return NextResponse.json({ error: "Minimum payment is $1.00" }, { status: 400 });
    }

    const paymentRequest: PaymentInitiateRequest = {
      product_name: `Balance payment — ${orderReference}`,
      amount,
      currency: "USD",
      provider: provider as PaymentInitiateRequest["provider"],
      origin: getSiteUrl(req),
      metadata: {
        orderId: order.id,
        orderReference: order.reference,
        paymentKind: "installment",
        buyerEmail: order.buyer_email,
        buyerName: order.buyer_name,
        buyerPhone: order.buyer_phone,
        eventId: order.event_id,
        ticketTypeId: order.ticket_type_id,
        quantity: order.quantity,
      },
    };

    const result = await PaymentService.initiatePayment(paymentRequest);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Could not start payment" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reference: result.reference,
      redirect_url: result.redirect_url,
      paynow_poll_url: result.paynow_poll_url,
      ecocash_end_user_id: result.ecocash_end_user_id,
      amount,
      balanceAfter: round2(balance - amount),
    });
  } catch (err) {
    console.error("pay-balance error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
