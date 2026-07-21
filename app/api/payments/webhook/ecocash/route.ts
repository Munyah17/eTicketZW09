import { NextRequest, NextResponse } from "next/server";
import { PaymentService, EcocashService } from "@/lib/services/payment-service";
import { logError } from "@/lib/error-logger";

// EcoCash Instant Payment notifyUrl webhook.
//
// Like the Paynow webhook, this body is unauthenticated and only ever treated
// as a wake-up signal — the status that drives fulfillment is fetched fresh
// from EcoCash's own Transaction Lookup endpoint, keyed on the endUserId we
// stored at initiation (falling back to whatever the callback body supplies).
export async function POST(req: NextRequest) {
  let reference = "";

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const params = new URLSearchParams(await req.text());
      params.forEach((value, key) => {
        body[key] = value;
      });
    }

    console.log("EcoCash webhook received:", body);

    reference = (body.clientCorrelator as string) || (body.referenceCode as string) || "";
    if (!reference) {
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const payment = await PaymentService.getPayment(reference);
    if (!payment) {
      console.error("EcoCash webhook: payment not found:", reference);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "failed") {
      return NextResponse.json({ success: true });
    }

    const endUserId = (payment.metadata?.ecocash_end_user_id as string) || (body.endUserId as string) || "";
    if (!endUserId) {
      logError("ecocash_webhook_no_end_user_id", new Error("No endUserId available to verify payment"), { reference });
      return NextResponse.json({ error: "Cannot verify payment without endUserId" }, { status: 400 });
    }

    const verified = await EcocashService.pollStatus(endUserId, reference);

    if (verified === "paid") {
      try {
        console.log("🚀 Starting fulfillment workflow for EcoCash payment:", reference);
        await PaymentService.confirmPaid(reference, {
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: "ecocash",
        });
        console.log("✅ Fulfillment complete for", reference);
      } catch (fulfillmentError) {
        console.error("❌ Fulfillment failed for EcoCash payment", reference, fulfillmentError);
        logError("ecocash_webhook_fulfillment_failed", fulfillmentError, { reference });
        // Acknowledge the webhook anyway — confirmPaid is resumable, and the
        // confirmation-page status poll or an admin confirm will retry it.
      }
    } else if (verified === "failed") {
      await PaymentService.markFailed(reference);
      console.log("EcoCash payment failed/cancelled:", reference);
    } else {
      console.log("EcoCash payment still pending after poll:", reference);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("ecocash_webhook", error, { reference });
    console.error("EcoCash webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
