import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { PaymentService } from "@/lib/services/payment-service";
import { generateTicket as createTicket } from "@/lib/ticket-generator";
import { sendTicketEmail } from "@/lib/email/send-ticket-email";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function verifyStripeSignature(body: string, signatureHeader: string, secret: string): boolean {
  // Stripe-Signature: t=timestamp,v1=sig1,v1=sig2,...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signatures = signatureHeader
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than tolerance window
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    console.error("Stripe webhook timestamp too old:", age, "seconds");
    return false;
  }

  const signedPayload = `${timestamp}.${body}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // Verify signature when webhook secret is configured
    if (STRIPE_WEBHOOK_SECRET) {
      if (!verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
        console.error("Stripe webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } else {
      console.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    }

    const event = JSON.parse(body);
    console.log("Stripe webhook received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const reference = session.metadata?.reference;

      console.log("Checkout session completed:", session.id, reference);

      if (!reference) {
        console.error("No reference in session metadata");
        return NextResponse.json({ error: "No reference" }, { status: 400 });
      }

      const payment = await PaymentService.getPayment(reference);
      if (!payment) {
        console.error("Payment not found:", reference);
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      if (payment.status === "paid" || payment.status === "failed") {
        console.log("Payment already processed:", reference, payment.status);
        return NextResponse.json({ received: true });
      }

      await PaymentService.updatePaymentStatus(reference, "paid");

      const existingTicket = await PaymentService.getTicketByPaymentReference(reference);
      if (!existingTicket) {
        const m = (payment.metadata ?? {}) as Record<string, unknown>;
        const ticket = await createTicket({
          paymentId: reference,
          eventId: (m.eventId as string) || "",
          ticketTypeId: (m.ticketTypeId as string) || "",
          ticketTypeName: m.ticketTypeName as string | undefined,
          eventTitle: m.eventTitle as string | undefined,
          eventDate: m.eventDate as string | undefined,
          eventTime: m.eventTime as string | undefined,
          venue: m.venue as string | undefined,
          buyerName: (m.buyerName as string) || "",
          buyerEmail: (m.buyerEmail as string) || "",
          buyerPhone: (m.buyerPhone as string) || "",
          buyerUserId: payment.userId,
          displayName: m.displayName as string | undefined,
          quantity: m.quantity as number | undefined,
          amount: session.amount_total / 100,
          currency: session.currency.toUpperCase(),
          paymentMethod: "stripe",
        });
        await sendTicketEmail(ticket);
      }

      console.log("Payment successful and ticket generated:", reference);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const reference = session.metadata?.reference;

      console.log("Checkout session expired:", session.id, reference);

      if (reference) {
        const payment = await PaymentService.getPayment(reference);
        if (payment && payment.status === "pending") {
          await PaymentService.updatePaymentStatus(reference, "failed");
          console.log("Payment expired:", reference);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
