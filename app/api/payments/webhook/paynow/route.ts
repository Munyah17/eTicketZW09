import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("Paynow webhook received:", body);

    // Paynow SDK sends: reference, status, amount
    const reference = body.reference;
    const status = body.status;
    const amount = body.amount;

    if (!reference || !status) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Get payment from database
    const payment = await PaymentService.getPayment(reference);
    if (!payment) {
      console.error("Payment not found:", reference);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Check if payment is already processed (idempotency)
    if (payment.status === "paid" || payment.status === "failed") {
      console.log("Payment already processed:", reference, payment.status);
      return NextResponse.json({ success: true });
    }

    // Process payment based on status
    if (status === "Paid" || status === "Delivered") {
      await PaymentService.confirmPaid(reference, {
        amount: amount || payment.amount,
        currency: payment.currency,
        paymentMethod: "paynow",
      });
      console.log("Payment successful and ticket generated:", reference);
    } else {
      await PaymentService.markFailed(reference);
      console.error("Payment failed:", reference, status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Paynow webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
