import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logger";
import { validationUrl } from "@/lib/ticket-png";
import { generateTicketNumber } from "@/lib/ticket-number";

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
  buyerUserId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  quantity?: number;
  displayName?: string;
  idNumber?: string;
  seatNumber?: string | null;
  // Who the ticket is FOR when bought on behalf of someone else — optional
  // by design (anonymity is allowed); only used for lost-ticket checks.
  receiverName?: string;
  // Group admission: one ticket admitting N people (family events).
  admitCount?: number;
  partyComposition?: { adults?: number; children?: number; seniors?: number };
  // Per-attendee details — required by checkout when the party includes
  // children under 18 (child safety), optional otherwise.
  attendees?: { name: string; idNumber?: string; ageGroup?: string; address?: string }[];
  // Groups every ticket minted under one payment_reference — powers the
  // batch barcode that pulls up each individual ticket at the gate.
  batchId?: string;
  // Dollar amount of the buyer-side service fee actually charged on this
  // sale (platform_config.service_fee_percent applied at checkout time) —
  // passed through from payment metadata rather than recomputed here, so
  // the wallet ledger reflects what was really charged even if the fee
  // percent changes later.
  buyerFeeAmount?: number;
  // Organizer-defined custom field responses, keyed by EventCustomField.id.
  customFieldResponses?: Record<string, string>;
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
  buyerEmail: string;
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
  seatNumber?: string | null;
  idNumber?: string | null;
  ticketNumber?: string | null;
  batchId?: string | null;
  receiverName?: string | null;
  admitCount?: number;
  partyComposition?: Record<string, number>;
  attendees?: { name: string; idNumber?: string; ageGroup?: string; address?: string }[];
}

// Thrown when create_ticket_with_capacity_check() finds the ticket type
// already at capacity — distinct from a generic DB error so callers can
// react to "we took their money but the last spot is gone" differently
// from "something broke".
export class TicketSoldOutError extends Error {
  constructor(public ticketTypeId: string, dbMessage: string) {
    super(`Ticket type ${ticketTypeId} is sold out: ${dbMessage}`);
    this.name = "TicketSoldOutError";
  }
}

// Resolves the commission rate for a sale: the event's own negotiated
// override if one is set, otherwise the platform-wide default. Read fresh
// per sale (not cached) so a rate change applies to the very next ticket.
async function resolveCommissionPercent(eventId: string): Promise<number> {
  const supabase = createAdminClient();
  const [{ data: event }, { data: config }] = await Promise.all([
    supabase.from("events").select("commission_percent").eq("id", eventId).maybeSingle(),
    supabase.from("platform_config").select("organizer_commission_percent").eq("id", 1).maybeSingle(),
  ]);
  if (event?.commission_percent !== null && event?.commission_percent !== undefined) {
    return Number(event.commission_percent);
  }
  return Number(config?.organizer_commission_percent ?? 5);
}

export async function generateTicket(data: TicketGenerationData): Promise<GeneratedTicket> {
  const ticketId = uuidv4();
  const qrCode = await generateQRCode(ticketId);
  const ticketNumber = generateTicketNumber();
  const batchId = data.batchId || uuidv4();

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
    buyerEmail: data.buyerEmail,
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
    seatNumber: data.seatNumber || null,
    idNumber: data.idNumber || null,
    ticketNumber,
    batchId,
    receiverName: data.receiverName || null,
    admitCount: data.admitCount || 1,
    partyComposition: (data.partyComposition ?? {}) as Record<string, number>,
    attendees: data.attendees ?? [],
  };

  // Commission is the organizer's cut being taken, so it must be based on
  // the organizer's actual base revenue for the whole purchase — total
  // amount charged minus the buyer-side service fee (which was never
  // organizer revenue) and NOT divided by quantity (ticket.price is a
  // per-unit figure used for display; commission applies to the full sale).
  const commissionPercent = await resolveCommissionPercent(data.eventId);
  const organizerBaseRevenue = data.amount - (data.buyerFeeAmount ?? 0);
  const commissionAmount = organizerBaseRevenue * (commissionPercent / 100);

  // Persisted via create_ticket_with_capacity_check() — a single Postgres
  // function that locks the ticket_type row, checks sold+requested against
  // quantity, and inserts the ticket, all in one transaction. A plain
  // .insert() here (the old approach) had no such gate: two buyers
  // completing payment for the last spot within the same window would both
  // get a valid ticket, since `sold` was only ever incremented *after*
  // insert by the existing tickets_sold_counts trigger. It now also writes
  // the matching wallet_ledger row in the same transaction, so a ticket can
  // never exist without its commission/fee record or vice versa.
  const supabase = createAdminClient();
  const { data: row, error } = await supabase.rpc("create_ticket_with_capacity_check", {
    p_id: ticketId,
    p_payment_reference: data.paymentId,
    p_event_id: data.eventId || null,
    p_ticket_type_id: data.ticketTypeId || null,
    p_ticket_type_name: ticket.ticketTypeName,
    p_event_title: ticket.eventTitle,
    p_event_date: ticket.eventDate,
    p_event_time: ticket.eventTime,
    p_venue: ticket.venue,
    p_buyer_name: ticket.buyerName,
    p_buyer_contact: ticket.buyerContact,
    p_buyer_display_name: ticket.buyerDisplayName,
    p_buyer_email: ticket.buyerEmail,
    p_buyer_user_id: data.buyerUserId || null,
    p_id_number: data.idNumber || "",
    p_price: ticket.price,
    p_markup: ticket.markup,
    p_total_paid: ticket.totalPaid,
    p_currency: ticket.currency,
    p_payment_method: ticket.paymentMethod,
    p_qr_code: ticket.qrCode,
    p_sale_type: ticket.saleType,
    p_seat_number: ticket.seatNumber,
    p_requested_qty: data.quantity || 1,
    p_buyer_fee_amount: data.buyerFeeAmount ?? 0,
    p_commission_amount: commissionAmount,
    p_custom_field_responses: data.customFieldResponses ?? {},
    p_ticket_number: ticketNumber,
    p_batch_id: batchId,
    p_receiver_name: data.receiverName || null,
    p_admit_count: data.admitCount || 1,
    p_party_composition: data.partyComposition ?? {},
    p_attendees: data.attendees ?? [],
  });

  if (error) {
    if (error.message?.includes("SOLD_OUT")) {
      throw new TicketSoldOutError(data.ticketTypeId, error.message);
    }
    // Ticket-number collision — the 5-char random tail hit an existing row.
    // ~60M combos makes this vanishingly rare; one retry with a fresh number
    // is the correct response, not a failure.
    if (error.message?.includes("ticket_number")) {
      logError("ticket_number_collision", error, { ticketId, ticketNumber });
      return generateTicket({ ...data, batchId });
    }
    logError("ticket_persist", error, { ticketId, paymentReference: data.paymentId });
    throw new Error(`Failed to persist ticket: ${error.message}`);
  }

  console.log("Ticket saved:", { ticketId, paymentReference: data.paymentId });
  return row ? dbRowToGeneratedTicket(row) : ticket;
}

function dbRowToGeneratedTicket(row: Record<string, unknown>): GeneratedTicket {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    ticketTypeId: row.ticket_type_id as string,
    ticketTypeName: row.ticket_type_name as string,
    eventTitle: row.event_title as string,
    eventDate: row.event_date as string,
    eventTime: row.event_time as string,
    venue: row.venue as string,
    buyerName: row.buyer_name as string,
    buyerContact: row.buyer_contact as string,
    buyerDisplayName: row.buyer_display_name as string,
    buyerEmail: row.buyer_email as string,
    price: Number(row.price),
    markup: Number(row.markup),
    totalPaid: Number(row.total_paid),
    currency: row.currency as string,
    paymentMethod: row.payment_method as string,
    paymentStatus: "completed",
    qrCode: row.qr_code as string,
    validated: Boolean(row.validated),
    isAdmitted: Boolean(row.is_admitted),
    purchasedAt: row.purchased_at as string,
    saleType: row.sale_type as "online" | "gate",
    seatNumber: (row.seat_number as string | null) ?? null,
    idNumber: (row.id_number as string | null) ?? null,
    ticketNumber: (row.ticket_number as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    receiverName: (row.receiver_name as string | null) ?? null,
    admitCount: Number(row.admit_count) || 1,
    partyComposition: (row.party_composition as Record<string, number>) ?? {},
    attendees: (row.attendees as { name: string; idNumber?: string; ageGroup?: string; address?: string }[]) ?? [],
  };
}

async function generateQRCode(ticketId: string): Promise<string> {
  try {
    // Encodes the confirmation-check URL so scanning with any phone camera
    // opens the eTicket validation page. Must stay in sync with the QR
    // rendered on the ticket PNG (lib/ticket-png.tsx).
    return await QRCode.toDataURL(validationUrl(ticketId));
  } catch (error) {
    logError("qr_code_generation", error, { ticketId });
    return ticketId;
  }
}
