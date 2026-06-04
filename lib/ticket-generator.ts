import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

export interface TicketGenerationData {
  paymentId: string;
  eventId: string;
  ticketTypeId: string;
  ticketTypeName?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  quantity?: number;
  displayName?: string;
}

export interface GeneratedTicket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  buyerName: string;
  buyerContact: string;
  buyerDisplayName: string;
  price: number;
  markup: number;
  totalPaid: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: "completed";
  qrCode: string;
  validated: boolean;
  isAdmitted: boolean;
  purchasedAt: string;
  saleType: "online" | "gate";
}

export async function generateTicket(data: TicketGenerationData): Promise<GeneratedTicket> {
  // Generate unique ticket ID
  const ticketId = `tkt-${uuidv4()}`;
  
  // Generate QR code
  const qrCode = await generateQRCode(ticketId);
  
  // Create ticket object
  const ticket: GeneratedTicket = {
    id: ticketId,
    eventId: data.eventId,
    ticketTypeId: data.ticketTypeId,
    ticketTypeName: data.ticketTypeName || "Standard",
    eventTitle: data.eventTitle || "Event",
    eventDate: data.eventDate || new Date().toISOString().split('T')[0],
    eventTime: data.eventTime || "19:00",
    venue: data.venue || "Venue",
    buyerName: data.buyerName,
    buyerContact: data.buyerPhone,
    buyerDisplayName: data.displayName || data.buyerName.split(' ').map(n => n[0]).join(''),
    price: data.amount / (data.quantity || 1),
    markup: 0,
    totalPaid: data.amount,
    currency: data.currency,
    paymentMethod: data.paymentMethod,
    paymentStatus: "completed",
    qrCode,
    validated: false,
    isAdmitted: false,
    purchasedAt: new Date().toISOString(),
    saleType: "online",
  };
  
  // Import PaymentService to persist ticket
  const { PaymentService } = await import("./services/payment-service");
  PaymentService.storeTicket(ticketId, { ...ticket, paymentId: data.paymentId });
  
  // TODO: Save ticket to database
  // TODO: Send confirmation email/SMS to buyer
  // TODO: Update event's sold ticket count
  
  console.log("Ticket generated and stored:", {
    ticketId: ticket.id,
    eventId: ticket.eventId,
    buyerEmail: data.buyerEmail,
    amount: data.amount,
  });

  return ticket;
}

async function generateQRCode(ticketId: string): Promise<string> {
  try {
    return await QRCode.toDataURL(ticketId);
  } catch (error) {
    console.error("QR code generation failed:", error);
    return ticketId; // Fallback to ticket ID as QR code
  }
}

export async function sendPaymentFailureNotification(buyerEmail: string, paymentId: string) {
  // TODO: Implement email/SMS notification for payment failure
  console.log("Payment failure notification sent to:", buyerEmail, "Payment ID:", paymentId);
  
  // This would typically:
  // - Send email to buyer explaining the payment failed
  // - Provide instructions to retry payment
  // - Log the failure for analytics
}

export async function sendPaymentSuccessNotification(ticket: GeneratedTicket, buyerEmail: string) {
  // TODO: Implement email/SMS notification for successful payment
  console.log("Payment success notification sent to:", buyerEmail, "Ticket ID:", ticket.id);
  
  // This would typically:
  // - Send email with ticket details and QR code
  // - Send SMS with ticket ID and event details
  // - Add to user's ticket wallet
}
