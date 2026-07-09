import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";
import { logError } from "@/lib/error-logger";

export async function POST(req: NextRequest) {
  let reference = "";
  let status = "";

  try {
    const body = await req.json();

    console.log("Paynow webhook received:", body);

    // Paynow SDK sends: reference, status, amount
    reference = body.reference;
    status = body.status;
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
      try {
        console.log("🚀 Starting fulfillment workflow for Paynow payment:", reference);
        await PaymentService.confirmPaid(reference, {
          amount: amount || payment.amount,
          currency: payment.currency,
          paymentMethod: "paynow",
        });
        console.log("✅ Fulfillment complete: Ticket generated and email sent for", reference);
      } catch (fulfillmentError) {
        console.error("❌ Fulfillment failed for Paynow payment", reference, fulfillmentError);
        logError("paynow_webhook_fulfillment_failed", fulfillmentError, {
          reference,
          status,
          amount,
        });
        // Even if fulfillment fails, we acknowledge the webhook to prevent retries
        // The payment is marked as paid, but fulfillment needs manual review
      }
    } else {
      await PaymentService.markFailed(reference);
      console.error("Payment failed:", reference, status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("paynow_webhook", error, { reference, status });
    console.error("Paynow webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
