import { v4 as uuidv4 } from "uuid";
// @ts-ignore - Paynow SDK doesn't have TypeScript types
import { Paynow } from "paynow";
import Stripe from "stripe";

export type PaymentProvider = "paynow" | "stripe";

export interface PaymentInitiateRequest {
  product_name: string;
  amount: number;
  currency: string;
  user_id?: string;
  provider: PaymentProvider;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
  error?: string;
}

// In-memory storage for payments (replace with database in production)
const payments = new Map<string, PaymentStatus>();
const tickets = new Map<string, any>();

export class PaymentService {
  static async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const reference = uuidv4();

    const payment: PaymentStatus = {
      id: uuidv4(),
      reference,
      provider: request.provider,
      amount: request.amount,
      currency: request.currency,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: request.metadata,
    };

    payments.set(reference, payment);

    let result: PaymentInitiateResponse;
    if (request.provider === "paynow") {
      result = await PaynowService.initiatePayment(reference, request);
    } else if (request.provider === "stripe") {
      result = await StripeService.initiatePayment(reference, request);
    } else {
      result = {
        success: false,
        reference,
        redirect_url: "",
        error: "Invalid payment provider",
      };
    }

    if (!result.success) {
      payment.status = "failed";
      payment.updated_at = new Date().toISOString();
      payment.error = result.error;
      payments.set(reference, payment);
    } else if (result.stripe_session_id) {
      payment.metadata = { ...payment.metadata, stripe_session_id: result.stripe_session_id };
      payments.set(reference, payment);
    }

    return result;
  }

  static async updatePaymentStatus(reference: string, status: "paid" | "failed"): Promise<void> {
    const payment = payments.get(reference);
    if (payment) {
      payment.status = status;
      payment.updated_at = new Date().toISOString();
      payments.set(reference, payment);
    }
  }

  static getPayment(reference: string): PaymentStatus | undefined {
    return payments.get(reference);
  }

  static storeTicket(ticketId: string, ticket: any): void {
    tickets.set(ticketId, ticket);
  }

  static getTicket(ticketId: string): any {
    return tickets.get(ticketId);
  }

  static getTicketByPaymentReference(reference: string): any | undefined {
    return Array.from(tickets.values()).find(t => t.paymentId === reference);
  }
}

class PaynowService {
  static async initiatePayment(reference: string, request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const PAYNOW_INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID || "";
    const PAYNOW_INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY || "";
    const origin = request.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY) {
      return {
        success: false,
        reference,
        redirect_url: "",
        error: "Paynow credentials are not configured. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.",
      };
    }

    const paynow = new Paynow(PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY);
    paynow.resultUrl = `${origin}/api/payments/webhook/paynow`;
    paynow.returnUrl = `${origin}/tickets/confirmation?ref=${reference}`;

    const buyerEmail = request.metadata?.buyerEmail || "customer@eticketszw.com";
    const payment = paynow.createPayment(reference, buyerEmail);
    payment.add(request.product_name, request.amount);

    try {
      const response = await paynow.send(payment);

      if (response.success) {
        return {
          success: true,
          reference,
          redirect_url: response.redirectUrl,
        };
      }

      const paynowError = response.error || response.errors?.join(", ") || "Paynow initiation failed";
      console.error("Paynow initiation failed:", paynowError);
      return {
        success: false,
        reference,
        redirect_url: "",
        error: paynowError,
      };
    } catch (error) {
      console.error("Paynow initiation error:", error);
      return {
        success: false,
        reference,
        redirect_url: "",
        error: "Failed to initiate Paynow payment",
      };
    }
  }
}

class StripeService {
  static async initiatePayment(reference: string, request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const origin = request.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!STRIPE_SECRET_KEY) {
      return {
        success: false,
        reference,
        redirect_url: "",
        error: "Stripe API key not configured",
      };
    }

    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        automatic_payment_methods: { enabled: true },
        line_items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              product_data: { name: request.product_name },
              unit_amount: Math.round(request.amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          reference,
          ...(request.user_id ? { user_id: request.user_id } : {}),
        },
        success_url: `${origin}/tickets/confirmation?ref=${reference}`,
        cancel_url: `${origin}/events`,
      });

      return {
        success: true,
        reference,
        redirect_url: session.url ?? "",
        stripe_session_id: session.id,
      };
    } catch (error: any) {
      console.error("Stripe initiation error:", error);
      return {
        success: false,
        reference,
        redirect_url: "",
        error: error?.message || "Failed to create Stripe checkout session",
      };
    }
  }
}
