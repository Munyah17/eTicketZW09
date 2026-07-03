import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";
import { generateTicket as createTicket } from "@/lib/ticket-generator";
import { sendTicketEmail } from "@/lib/email/send-ticket-email";

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
      // Payment successful - generate ticket
      await PaymentService.updatePaymentStatus(reference, "paid");
      
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
        amount: amount || payment.amount,
        currency: payment.currency,
        paymentMethod: "paynow",
      });
      await sendTicketEmail(ticket);

      console.log("Payment successful and ticket generated:", reference);
    } else {
      // Payment failed
      await PaymentService.updatePaymentStatus(reference, "failed");
      console.error("Payment failed:", reference, status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Paynow webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
