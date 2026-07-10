import { NextRequest, NextResponse } from "next/server";
import { PaymentService, PaynowService } from "@/lib/services/payment-service";
import { logError } from "@/lib/error-logger";

// Paynow result-URL webhook.
//
// Paynow POSTs application/x-www-form-urlencoded fields (reference,
// paynowreference, amount, status, pollurl, hash) — NOT JSON. The previous
// version of this handler called req.json(), so every real Paynow callback
// failed with a parse error and payments sat in "pending" until an admin
// manually confirmed them.
//
// The webhook body is treated purely as a wake-up signal: the status that
// drives fulfillment is fetched from Paynow's own servers via the poll URL
// stored at initiation, so a forged POST cannot mint tickets.
export async function POST(req: NextRequest) {
  let reference = "";

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const params = new URLSearchParams(await req.text());
      params.forEach((value, key) => {
        body[key.toLowerCase()] = value;
      });
    }

    console.log("Paynow webhook received:", body);

    reference = body.reference || "";
    if (!reference) {
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const payment = await PaymentService.getPayment(reference);
    if (!payment) {
      console.error("Paynow webhook: payment not found:", reference);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Idempotency: fulfillment already ran (confirmPaid itself also re-checks
    // against the tickets table, so a paid-but-unfulfilled payment still resumes).
    if (payment.status === "failed") {
      return NextResponse.json({ success: true });
    }

    // Verify with Paynow directly. Prefer the poll URL we stored at initiation;
    // fall back to the one in the webhook body (pollStatus rejects non-Paynow hosts).
    const pollUrl = (payment.metadata?.paynow_poll_url as string) || body.pollurl || "";
    if (!pollUrl) {
      logError("paynow_webhook_no_poll_url", new Error("No poll URL available to verify payment"), { reference });
      return NextResponse.json({ error: "Cannot verify payment without poll URL" }, { status: 400 });
    }

    const verified = await PaynowService.pollStatus(pollUrl);

    if (verified === "paid") {
      try {
        console.log("🚀 Starting fulfillment workflow for Paynow payment:", reference);
        await PaymentService.confirmPaid(reference, {
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: "paynow",
        });
        console.log("✅ Fulfillment complete for", reference);
      } catch (fulfillmentError) {
        console.error("❌ Fulfillment failed for Paynow payment", reference, fulfillmentError);
        logError("paynow_webhook_fulfillment_failed", fulfillmentError, { reference });
        // Acknowledge the webhook anyway — confirmPaid is resumable, and the
        // confirmation-page status poll or an admin confirm will retry it.
      }
    } else if (verified === "failed") {
      await PaymentService.markFailed(reference);
      console.log("Paynow payment failed/cancelled:", reference);
    } else {
      console.log("Paynow payment still pending after poll:", reference);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("paynow_webhook", error, { reference });
    console.error("Paynow webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
