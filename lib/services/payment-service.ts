import { v4 as uuidv4 } from "uuid";
// @ts-ignore - Paynow SDK doesn't have TypeScript types
import { Paynow } from "paynow";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTicket } from "@/lib/ticket-generator";
import { sendTicketEmail } from "@/lib/email/send-ticket-email";
import { sendSaleNotificationEmails } from "@/lib/email/send-sale-notification-emails";
import { sendTicketWhatsApp } from "@/lib/whatsapp";
import { logError } from "@/lib/error-logger";

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
  paynow_poll_url?: string;
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
  userId?: string;
}

export class PaymentService {
  static async initiatePayment(request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const reference = uuidv4();
    const supabase = createAdminClient();

    const { error: insertError } = await supabase.from("payments").insert({
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

    if (insertError) {
      console.error("Payment record insert failed:", insertError.message);
      return { success: false, reference, redirect_url: "", error: "Failed to create payment record" };
    }

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
      const { error: updateError } = await supabase.from("payments")
        .update({ stripe_session_id: result.stripe_session_id, metadata: { ...request.metadata, stripe_session_id: result.stripe_session_id } })
        .eq("reference", reference);
      if (updateError) {
        console.error("Payment stripe_session_id update failed:", updateError.message);
      }
    } else if (result.paynow_poll_url) {
      // The poll URL is how we later verify the payment directly with Paynow's
      // servers (webhook bodies are unauthenticated and cannot be trusted).
      const { error: updateError } = await supabase.from("payments")
        .update({ metadata: { ...request.metadata, paynow_poll_url: result.paynow_poll_url } })
        .eq("reference", reference);
      if (updateError) {
        console.error("Payment paynow_poll_url update failed:", updateError.message);
      }
    }

    return result;
  }

  static async updatePaymentStatus(reference: string, status: "paid" | "failed"): Promise<void> {
    const supabase = createAdminClient();
    await supabase.from("payments").update({ status }).eq("reference", reference);
  }

  // Shared "this payment succeeded" path — used by the Stripe/Paynow webhooks,
  // the direct Stripe status re-check, and the admin manual-verification tool.
  // CRITICAL: This is the main fulfillment orchestrator. Every step must succeed
  // before marking ticket as fulfilled.
  static async confirmPaid(
    reference: string,
    opts: { amount?: number; currency?: string; paymentMethod: string }
  ): Promise<void> {
    try {
      const payment = await PaymentService.getPayment(reference);
      if (!payment) {
        logError("confirmPaid_payment_not_found", new Error("Payment not found"), { reference });
        throw new Error(`Payment not found: ${reference}`);
      }

      // Idempotency: the ticket row is the real completion marker, not the
      // payment status. A payment can be "paid" with generation having failed
      // mid-flight (crash, bad metadata) — in that case a retry must fall
      // through and produce the ticket instead of returning early, otherwise
      // the buyer is permanently stuck with a paid payment and no ticket.
      const existingTicket = await PaymentService.getTicketByPaymentReference(reference);
      if (existingTicket) {
        console.log("confirmPaid: Ticket already exists", reference, existingTicket.id);
        return;
      }
      if (payment.status === "failed") {
        console.log("confirmPaid: Payment previously marked failed — not fulfilling", reference);
        return;
      }
      if (payment.status === "paid") {
        console.log("confirmPaid: Payment already paid but no ticket found — resuming fulfillment", reference);
      }

      // Step 1: Mark as paid in database
      console.log("Step 1/7: Marking payment as paid...", reference);
      await PaymentService.updatePaymentStatus(reference, "paid");

      // Step 3: Generate ticket
      const m = (payment.metadata ?? {}) as Record<string, unknown>;
      console.log("Step 2/7: Generating ticket...", reference);
      console.log("Payment metadata:", m);

      if (!m.buyerEmail) {
        logError("confirmPaid_missing_buyer_email", new Error("Buyer email required for ticket generation"), {
          reference,
          metadata: m
        });
        throw new Error("Buyer email is required to generate ticket");
      }

      const ticket = await generateTicket({
        paymentId: reference,
        eventId: (m.eventId as string) || "",
        ticketTypeId: (m.ticketTypeId as string) || "",
        ticketTypeName: m.ticketTypeName as string | undefined,
        eventTitle: m.eventTitle as string | undefined,
        eventDate: m.eventDate as string | undefined,
        eventTime: m.eventTime as string | undefined,
        venue: m.venue as string | undefined,
        buyerName: (m.buyerName as string) || "Guest",
        buyerEmail: (m.buyerEmail as string) || "",
        buyerPhone: (m.buyerPhone as string) || "",
        buyerUserId: payment.userId,
        displayName: m.displayName as string | undefined,
        idNumber: m.idNumber as string | undefined,
        quantity: m.quantity as number | undefined,
        amount: opts.amount ?? payment.amount,
        currency: (opts.currency ?? payment.currency).toUpperCase(),
        paymentMethod: opts.paymentMethod,
      });

      if (!ticket || !ticket.id) {
        throw new Error("Failed to generate ticket");
      }

      console.log("✓ Step 3/7: Ticket generated", ticket.id);

      // Step 4: Confirm from the backend that the ticket was actually persisted.
      // Generation returning an object is not proof — the DB row is.
      const persisted = await PaymentService.getTicketByPaymentReference(reference);
      if (!persisted || persisted.id !== ticket.id) {
        throw new Error(`Ticket generation could not be confirmed in database for payment ${reference}`);
      }
      console.log("✓ Step 4/7: Ticket confirmed in database", ticket.id);

      // Step 5: Push the ticket to the buyer on both channels. Delivery is the
      // proof of issuance — the ticket is only "issued" once at least one push
      // has actually landed.
      const buyerPhone = (m.buyerPhone as string) || ticket.buyerContact || "";
      console.log("Step 5/7: Pushing ticket to email + WhatsApp...", ticket.buyerEmail, buyerPhone);
      const [emailResult, whatsappResult] = await Promise.all([
        sendTicketEmail(ticket),
        sendTicketWhatsApp(ticket, buyerPhone),
      ]);

      const issued = emailResult.sent || whatsappResult.sent;
      const now = new Date().toISOString();
      const supabase = createAdminClient();
      // Best-effort delivery bookkeeping — must never fail fulfillment (e.g.
      // before the delivery-tracking migration has been applied).
      const { error: deliveryUpdateError } = await supabase
        .from("tickets")
        .update({
          email_delivered_at: emailResult.sent ? now : null,
          whatsapp_delivered_at: whatsappResult.sent ? now : null,
          issued_at: issued ? now : null,
          delivery_log: [
            { channel: "email", at: now, ...emailResult },
            { channel: "whatsapp", at: now, ...whatsappResult },
          ],
        })
        .eq("id", ticket.id);
      if (deliveryUpdateError) {
        logError("ticket_delivery_tracking_update_failed", deliveryUpdateError, { reference, ticketId: ticket.id });
      }

      if (!issued) {
        logError("ticket_generated_but_not_issued", new Error("All delivery channels failed"), {
          reference,
          ticketId: ticket.id,
          emailError: emailResult.error,
          whatsappError: whatsappResult.error,
        });
        console.error("⚠️ Ticket generated but NOT issued — no delivery channel succeeded", ticket.id);
      } else {
        console.log(
          `✓ Step 6/7: Ticket issued — email: ${emailResult.sent ? "delivered" : emailResult.error}, ` +
          `whatsapp: ${whatsappResult.sent ? "delivered" : whatsappResult.error}`
        );
      }

      // Step 6: Send sale notification emails
      console.log("Step 7/7: Sending sale notifications...");
      await sendSaleNotificationEmails(ticket);
      console.log("✓ Step 7/7: Sale notifications sent");

      console.log(issued ? "✅ FULFILLMENT COMPLETE — TICKET ISSUED:" : "⚠️ FULFILLMENT INCOMPLETE — TICKET NOT ISSUED:", reference, ticket.id);
    } catch (error) {
      logError("confirmPaid_workflow_failed", error, { reference, paymentMethod: opts.paymentMethod });
      console.error("❌ FULFILLMENT FAILED for payment", reference, error);
      throw error; // Re-throw so the endpoint knows fulfillment failed
    }
  }

  // Shared "this payment did not succeed" path. Idempotent like confirmPaid.
  static async markFailed(reference: string): Promise<void> {
    const payment = await PaymentService.getPayment(reference);
    if (!payment || payment.status === "paid" || payment.status === "failed") return;
    await PaymentService.updatePaymentStatus(reference, "failed");
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
      userId: data.user_id ?? undefined,
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
      if (response.success) {
        return {
          success: true,
          reference,
          redirect_url: response.redirectUrl,
          paynow_poll_url: response.pollUrl,
        };
      }
      const paynowError = response.error || response.errors?.join(", ") || "Paynow initiation failed";
      return { success: false, reference, redirect_url: "", error: paynowError };
    } catch (error) {
      logError("paynow_initiate", error, { reference });
      return { success: false, reference, redirect_url: "", error: "Failed to initiate Paynow payment" };
    }
  }

  // Asks Paynow's own servers for the transaction status — the only
  // trustworthy source. Returns "paid", "failed", or "pending".
  static async pollStatus(pollUrl: string): Promise<"paid" | "failed" | "pending"> {
    const PAYNOW_INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID || "";
    const PAYNOW_INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY || "";
    if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY) {
      throw new Error("Paynow credentials are not configured");
    }

    // Never poll a URL outside Paynow — a forged webhook could otherwise point
    // us at an attacker-controlled server that answers "Paid".
    const host = new URL(pollUrl).hostname;
    if (host !== "paynow.co.zw" && !host.endsWith(".paynow.co.zw")) {
      throw new Error(`Refusing to poll non-Paynow URL: ${host}`);
    }

    const paynow = new Paynow(PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY);
    const status = await paynow.pollTransaction(pollUrl);
    const s = String(status?.status ?? "").toLowerCase();
    if (s === "paid" || s === "awaiting delivery" || s === "delivered") return "paid";
    if (s === "cancelled" || s === "failed" || s === "disputed" || s === "refunded") return "failed";
    return "pending";
  }
}

export { PaynowService };

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
      logError("stripe_initiate", error, { reference });
      return { success: false, reference, redirect_url: "", error: (error as Error)?.message || "Failed to create Stripe session" };
    }
  }
}
