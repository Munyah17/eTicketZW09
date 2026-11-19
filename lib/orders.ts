import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketOrder, PurchasedAddOn } from "@/lib/types";

// Server-side helpers for split-payment orders. A ticket_orders row groups the
// one-or-more payments that together settle a single ticket purchase; tickets
// are only minted once amount_paid covers total. All writes go through the
// service-role client — buyers never write orders directly.

export interface OrderRow {
  id: string;
  reference: string;
  event_id: string;
  ticket_type_id: string;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  custom_field_responses: Record<string, string>;
  add_ons: PurchasedAddOn[];
  purchase_metadata: Record<string, unknown>;
  subtotal: number;
  fees: number;
  total: number;
  amount_paid: number;
  balance: number;
  status: string;
  payment_plan: TicketOrder["paymentPlan"] | null;
  created_at: string;
  updated_at: string;
}

export function orderRowToOrder(r: OrderRow): TicketOrder {
  return {
    id: r.id,
    reference: r.reference,
    eventId: r.event_id,
    ticketTypeId: r.ticket_type_id,
    quantity: r.quantity,
    buyerName: r.buyer_name,
    buyerEmail: r.buyer_email,
    buyerPhone: r.buyer_phone || undefined,
    customFieldResponses: r.custom_field_responses || {},
    addOns: r.add_ons || [],
    subtotal: Number(r.subtotal),
    fees: Number(r.fees),
    total: Number(r.total),
    amountPaid: Number(r.amount_paid),
    balance: Number(r.balance),
    status: r.status as TicketOrder["status"],
    paymentPlan: r.payment_plan || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getOrderById(id: string): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ticket_orders").select("*").eq("id", id).maybeSingle();
  return (data as OrderRow) ?? null;
}

export async function getOrderByReference(reference: string): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ticket_orders").select("*").eq("reference", reference).maybeSingle();
  return (data as OrderRow) ?? null;
}

// Removes an order that never received a payment — used to clean up the row
// created for a split purchase when payment initiation then fails, so a
// "pending, $0 paid" order doesn't linger and confuse the buyer.
export async function deleteOrder(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("ticket_orders").delete().eq("id", id);
}

export interface CreateOrderInput {
  reference: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  customFieldResponses?: Record<string, string>;
  addOns?: PurchasedAddOn[];
  purchaseMetadata?: Record<string, unknown>;
  subtotal: number;
  fees: number;
  total: number;
  depositPercent: number;
  installmentCount: number;
}

// Creates a pending order for a split-payment purchase. amount_paid starts at
// 0; the deposit payment (created alongside) is what moves it forward.
export async function createOrder(input: CreateOrderInput): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const balance = input.total;
  const { data, error } = await supabase
    .from("ticket_orders")
    .insert({
      reference: input.reference,
      event_id: input.eventId,
      ticket_type_id: input.ticketTypeId,
      quantity: input.quantity,
      buyer_name: input.buyerName,
      buyer_email: input.buyerEmail,
      buyer_phone: input.buyerPhone || "",
      custom_field_responses: input.customFieldResponses || {},
      add_ons: input.addOns || [],
      purchase_metadata: input.purchaseMetadata || {},
      subtotal: input.subtotal,
      fees: input.fees,
      total: input.total,
      amount_paid: 0,
      balance,
      status: "pending",
      payment_plan: {
        depositPercent: input.depositPercent,
        installmentCount: input.installmentCount,
        installments: [],
      },
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("createOrder failed:", error?.message);
    return null;
  }
  return data as OrderRow;
}

// Records a successful payment against an order and returns the updated row.
// `amount` is the gross amount this payment settled toward the order total.
// When balance reaches ~0 the order flips to "paid" — the caller then issues
// the tickets. Idempotent per paymentReference: confirmPaid can fire more than
// once for the same payment (webhook + status poll + admin confirm), and each
// must not double-count toward the balance.
//
// The accumulation runs inside the record_order_payment Postgres function,
// which takes a row lock (SELECT ... FOR UPDATE) so two concurrent installment
// confirmations serialise instead of losing an update.
export async function recordOrderPayment(orderId: string, amount: number, paymentReference?: string): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("record_order_payment", {
    p_order_id: orderId,
    p_amount: amount,
    p_reference: paymentReference ?? null,
  });
  if (error) {
    console.error("recordOrderPayment failed:", error.message);
    return null;
  }
  return (data as OrderRow) ?? null;
}
