import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";
import { generateTicket as createTicket } from "@/lib/ticket-generator";

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
    const payment = PaymentService.getPayment(reference);
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
      
      // Generate ticket
      await createTicket({
        paymentId: reference,
        eventId: payment.metadata?.eventId || "",
        ticketTypeId: payment.metadata?.ticketTypeId || "",
        ticketTypeName: payment.metadata?.ticketTypeName,
        eventTitle: payment.metadata?.eventTitle,
        eventDate: payment.metadata?.eventDate,
        eventTime: payment.metadata?.eventTime,
        venue: payment.metadata?.venue,
        buyerName: payment.metadata?.buyerName || "",
        buyerEmail: payment.metadata?.buyerEmail || "",
        buyerPhone: payment.metadata?.buyerPhone || "",
        displayName: payment.metadata?.displayName,
        quantity: payment.metadata?.quantity,
        amount: amount || payment.amount,
        currency: payment.currency,
        paymentMethod: "paynow",
      });
      
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
