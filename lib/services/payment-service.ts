import { v4 as uuidv4 } from "uuid";
// @ts-ignore - Paynow SDK doesn't have TypeScript types
import { Paynow } from "paynow";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentProvider = "paynow" | "stripe";

export interface PaymentInitiateRequest {
  product_name: string;
  amount: number;
  currency: string;
  user_id?: string;
  event_id?: string;
  ticket_type_id?: string;
  provider: PaymentProvider;
  metadata?: Record<string, unknown>;
  origin?: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  reference: string;
  redirect_url: string;
  stripe_session_id?: string;
  error?: string;
}

export interface PaymentStatus {
  id: string;
  reference: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export class PaymentService {
  static async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const reference = uuidv4();
    const supabase = createAdminClient();

    await supabase.from("payments").insert({
      reference,
      provider: request.provider,
      amount: request.amount,
      currency: request.currency,
      status: "pending",
      user_id: request.user_id || null,
      event_id: request.event_id || null,
      ticket_type_id: request.ticket_type_id || null,
      metadata: request.metadata || {},
    });

    let result: PaymentInitiateResponse;
    if (request.provider === "paynow") {
      result = await PaynowService.initiatePayment(reference, request);
    } else if (request.provider === "stripe") {
      result = await StripeService.initiatePayment(reference, request);
    } else {
      result = { success: false, reference, redirect_url: "", error: "Invalid payment provider" };
    }

    if (!result.success) {
      await supabase.from("payments").update({ status: "failed", error_message: result.error }).eq("reference", reference);
    } else if (result.stripe_session_id) {
      await supabase.from("payments")
        .update({ stripe_session_id: result.stripe_session_id, metadata: { ...request.metadata, stripe_session_id: result.stripe_session_id } })
        .eq("reference", reference);
    }

    return result;
  }

  static async updatePaymentStatus(reference: string, status: "paid" | "failed"): Promise<void> {
    const supabase = createAdminClient();
    await supabase.from("payments").update({ status }).eq("reference", reference);
  }

  static async getPayment(reference: string): Promise<PaymentStatus | undefined> {
    const supabase = createAdminClient();
    const { data } = await supabase.from("payments").select("*").eq("reference", reference).single();
    if (!data) return undefined;
    return {
      id: data.id,
      reference: data.reference,
      provider: data.provider as PaymentProvider,
      amount: Number(data.amount),
      currency: data.currency,
      status: data.status as PaymentStatus["status"],
      created_at: data.created_at,
      updated_at: data.updated_at,
      metadata: data.metadata,
      error: data.error_message,
    };
  }

  static async storeTicket(ticketId: string, ticket: Record<string, unknown>): Promise<void> {
    // Tickets are now stored in the tickets table directly by API routes
    // This is kept for backward compatibility during migration
    const supabase = createAdminClient();
    await supabase.from("tickets").upsert({ id: ticketId, ...ticket }, { onConflict: "id" });
  }

  static async getTicket(ticketId: string): Promise<Record<string, unknown> | undefined> {
    const supabase = createAdminClient();
    const { data } = await supabase.from("tickets").select("*").eq("id", ticketId).single();
    return data || undefined;
  }

  static async getTicketByPaymentReference(reference: string): Promise<Record<string, unknown> | undefined> {
    const supabase = createAdminClient();
    const { data } = await supabase.from("tickets").select("*").eq("payment_reference", reference).maybeSingle();
    return data || undefined;
  }
}

class PaynowService {
  static async initiatePayment(reference: string, request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const PAYNOW_INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID || "";
    const PAYNOW_INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY || "";
    const origin = request.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY) {
      return { success: false, reference, redirect_url: "", error: "Paynow credentials are not configured." };
    }

    const paynow = new Paynow(PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY);
    paynow.resultUrl = `${origin}/api/payments/webhook/paynow`;
    paynow.returnUrl = `${origin}/tickets/confirmation?ref=${reference}`;

    const buyerEmail = (request.metadata?.buyerEmail as string) || "customer@eticketszw.com";
    const payment = paynow.createPayment(reference, buyerEmail);
    payment.add(request.product_name, request.amount);

    try {
      const response = await paynow.send(payment);
      if (response.success) return { success: true, reference, redirect_url: response.redirectUrl };
      const paynowError = response.error || response.errors?.join(", ") || "Paynow initiation failed";
      return { success: false, reference, redirect_url: "", error: paynowError };
    } catch (error) {
      console.error("Paynow error:", error);
      return { success: false, reference, redirect_url: "", error: "Failed to initiate Paynow payment" };
    }
  }
}

class StripeService {
  static async initiatePayment(reference: string, request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const origin = request.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!STRIPE_SECRET_KEY) {
      return { success: false, reference, redirect_url: "", error: "Stripe API key not configured" };
    }

    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: request.currency.toLowerCase(),
            product_data: { name: request.product_name },
            unit_amount: Math.round(request.amount * 100),
          },
          quantity: 1,
        }],
        metadata: {
          reference,
          ...(request.user_id ? { user_id: request.user_id } : {}),
          ...(request.event_id ? { event_id: request.event_id } : {}),
        },
        success_url: `${origin}/tickets/confirmation?ref=${reference}`,
        cancel_url: `${origin}/events`,
      });
      return { success: true, reference, redirect_url: session.url ?? "", stripe_session_id: session.id };
    } catch (error: unknown) {
      console.error("Stripe error:", error);
      return { success: false, reference, redirect_url: "", error: (error as Error)?.message || "Failed to create Stripe session" };
    }
  }
}
