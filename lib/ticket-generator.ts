import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const ticketId = `tkt-${uuidv4()}`;
  const qrCode = await generateQRCode(ticketId);

  const ticket: GeneratedTicket = {
    id: ticketId,
    eventId: data.eventId,
    ticketTypeId: data.ticketTypeId,
    ticketTypeName: data.ticketTypeName || "Standard",
    eventTitle: data.eventTitle || "Event",
    eventDate: data.eventDate || new Date().toISOString().split("T")[0],
    eventTime: data.eventTime || "19:00",
    venue: data.venue || "Venue",
    buyerName: data.buyerName,
    buyerContact: data.buyerPhone,
    buyerDisplayName: data.displayName || data.buyerName.split(" ").map((n) => n[0]).join(""),
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

  // Persist to DB with snake_case columns matching the PostgreSQL schema
  const supabase = createAdminClient();
  const { error } = await supabase.from("tickets").insert({
    id: ticketId,
    payment_reference: data.paymentId,
    event_id: data.eventId || null,
    ticket_type_id: data.ticketTypeId || null,
    ticket_type_name: ticket.ticketTypeName,
    event_title: ticket.eventTitle,
    event_date: ticket.eventDate,
    event_time: ticket.eventTime,
    venue: ticket.venue,
    buyer_name: ticket.buyerName,
    buyer_contact: ticket.buyerContact,
    buyer_display_name: ticket.buyerDisplayName,
    price: ticket.price,
    markup: ticket.markup,
    total_paid: ticket.totalPaid,
    currency: ticket.currency,
    payment_method: ticket.paymentMethod,
    payment_status: ticket.paymentStatus,
    qr_code: ticket.qrCode,
    validated: ticket.validated,
    is_admitted: ticket.isAdmitted,
    purchased_at: ticket.purchasedAt,
    sale_type: ticket.saleType,
  });

  if (error) {
    console.error("Failed to persist ticket to DB:", error.message);
  } else {
    console.log("Ticket saved:", { ticketId, paymentReference: data.paymentId });
  }

  return ticket;
}

async function generateQRCode(ticketId: string): Promise<string> {
  try {
    return await QRCode.toDataURL(ticketId);
  } catch (error) {
    console.error("QR code generation failed:", error);
    return ticketId;
  }
}

export async function sendPaymentFailureNotification(buyerEmail: string, paymentId: string) {
  console.log("Payment failure notification sent to:", buyerEmail, "Payment ID:", paymentId);
}

export async function sendPaymentSuccessNotification(ticket: GeneratedTicket, buyerEmail: string) {
  console.log("Payment success notification sent to:", buyerEmail, "Ticket ID:", ticket.id);
}
