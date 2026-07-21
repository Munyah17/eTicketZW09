import { v4 as uuidv4 } from "uuid";
// @ts-ignore - Paynow SDK doesn't have TypeScript types
import { Paynow } from "paynow";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTicket, TicketSoldOutError } from "@/lib/ticket-generator";
import { sendTicketEmail } from "@/lib/email/send-ticket-email";
import { sendSaleNotificationEmails } from "@/lib/email/send-sale-notification-emails";
import { sendTicketWhatsApp } from "@/lib/whatsapp";
import { logError } from "@/lib/error-logger";

export type PaymentProvider = "paynow" | "stripe" | "ecocash";

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
  ecocash_end_user_id?: string;
  error?: string;
}

export interface PaymentStatus {
  id: string;
  reference: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "paid_refund_required";
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
    } else if (request.provider === "ecocash") {
      result = await EcocashService.initiatePayment(reference, request);
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
    } else if (result.ecocash_end_user_id) {
      // Needed later to poll EcoCash's Transaction Lookup endpoint — the
      // lookup is keyed on endUserId + clientCorrelator (our reference),
      // same "never trust the webhook body alone" reasoning as Paynow above.
      const { error: updateError } = await supabase.from("payments")
        .update({ metadata: { ...request.metadata, ecocash_end_user_id: result.ecocash_end_user_id } })
        .eq("reference", reference);
      if (updateError) {
        console.error("Payment ecocash_end_user_id update failed:", updateError.message);
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
      if (payment.status === "paid_refund_required") {
        // Already flagged sold-out-at-fulfillment — don't retry automatically.
        // Resolving this needs a human decision (refund, or raise capacity
        // and manually re-trigger), not another identical attempt that will
        // fail the same way.
        console.log("confirmPaid: Previously flagged oversold/refund-required — not retrying", reference);
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

      let ticket;
      try {
        ticket = await generateTicket({
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
          seatNumber: m.seatNumber as string | undefined,
          quantity: m.quantity as number | undefined,
          amount: opts.amount ?? payment.amount,
          currency: (opts.currency ?? payment.currency).toUpperCase(),
          paymentMethod: opts.paymentMethod,
        });
      } catch (genError) {
        if (genError instanceof TicketSoldOutError) {
          // Money has already been captured by the provider — this is not a
          // "retry and it'll work" failure, it needs a human to refund the
          // buyer. Flag it as loudly and searchably as possible: a distinct
          // payments.status value (not the generic "paid") so it can't be
          // mistaken for a normal successful sale, plus a clear error_message.
          const flagMessage = `SOLD OUT AT FULFILLMENT — payment captured, no ticket issued, refund required. ${genError.message}`;
          await createAdminClient()
            .from("payments")
            .update({ status: "paid_refund_required", error_message: flagMessage })
            .eq("reference", reference);
          logError("ticket_oversold_refund_required", genError, { reference, ticketTypeId: genError.ticketTypeId });
          console.error("🔴 OVERSOLD — REFUND REQUIRED:", reference, genError.message);
          return;
        }
        throw genError;
      }

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

// EcoCash Instant Payment (EIP) — direct wallet-charge API, distinct from
// Paynow. There is no hosted checkout page: a Charge Request pushes a USSD
// PIN prompt straight to the buyer's phone, and the final outcome is only
// known once we poll Transaction Lookup (or the notifyUrl webhook fires, but
// per the same "unauthenticated webhook body" reasoning as Paynow, that is
// only ever a wake-up signal — never trusted for the actual status).
class EcocashService {
  // EIP's endUserId is the bare 9-digit subscriber number (e.g. "773047653"),
  // not the 263-prefixed or 0-prefixed forms buyers normally type.
  static normalizeMsisdn(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("263")) return digits.slice(3);
    if (digits.startsWith("0")) return digits.slice(1);
    return digits;
  }

  private static authHeader(): string {
    const username = process.env.ECOCASH_EIP_USERNAME || "";
    const password = process.env.ECOCASH_EIP_PASSWORD || "";
    return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  // developers.ecocash.co.zw sits behind Cloudflare bot protection that
  // blocks anything that doesn't look like a real browser — confirmed
  // against the live sandbox: a generic "compatible; …" User-Agent alone
  // still gets the literal Cloudflare block page, not a JSON response from
  // EcoCash's own API at all. A real Chrome UA plus matching Origin/Referer
  // gets through.
  private static requestHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: EcocashService.authHeader(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://developers.ecocash.co.zw",
      Referer: "https://developers.ecocash.co.zw/",
      ...extra,
    };
  }

  // The EIP sandbox response schema doesn't match its own docs consistently
  // (fields seen: status / statusMessage / transactionOperationStatus / text)
  // — classify defensively off whatever text fields are present rather than
  // depending on one exact field.
  private static classify(body: Record<string, unknown>): "paid" | "failed" | "pending" {
    const haystack = [
      body.status,
      body.statusMessage,
      body.transactionOperationStatus,
      body.text,
      body.ecocashResponseCode,
      body.responseMessage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (/success/.test(haystack)) return "paid";
    if (/insufficient|invalid|fail|barred|limit|cancel|declin/.test(haystack)) return "failed";
    return "pending";
  }

  static async initiatePayment(reference: string, request: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const baseUrl = process.env.ECOCASH_EIP_BASE_URL || "";
    const merchantCode = process.env.ECOCASH_MERCHANT_CODE || "";
    const merchantPin = process.env.ECOCASH_MERCHANT_PIN || "";
    const merchantNumber = process.env.ECOCASH_MERCHANT_NUMBER || "";
    const terminalID = process.env.ECOCASH_TERMINAL_ID || "WEB01";

    if (!baseUrl || !process.env.ECOCASH_EIP_USERNAME || !process.env.ECOCASH_EIP_PASSWORD || !merchantCode || !merchantPin || !merchantNumber) {
      return { success: false, reference, redirect_url: "", error: "EcoCash Instant Payment credentials are not configured." };
    }

    const buyerPhone = (request.metadata?.buyerPhone as string) || "";
    const endUserId = EcocashService.normalizeMsisdn(buyerPhone);
    if (!endUserId || endUserId.length < 9) {
      return { success: false, reference, redirect_url: "", error: "A valid EcoCash phone number is required." };
    }

    const origin = request.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const body = {
      clientCorrelator: reference,
      notifyUrl: `${origin}/api/payments/webhook/ecocash`,
      referenceCode: reference,
      tranType: "MER",
      endUserId,
      remarks: "E-TicketsZW",
      transactionOperationStatus: "Charged",
      terminalID,
      paymentAmount: {
        charginginformation: {
          amount: request.amount,
          currency: request.currency.toUpperCase(),
          description: request.product_name,
        },
        chargeMetaData: { channel: "WEB" },
      },
      merchantCode,
      merchantPin,
      merchantNumber,
      countryCode: "ZW",
      location: "Harare",
      superMerchantName: "ECOCASH",
      merchantName: "E-TicketsZW",
    };

    try {
      const res = await fetch(`${baseUrl}/transactions/amount/`, {
        method: "POST",
        headers: EcocashService.requestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = (data.statusMessage as string) || (data.message as string) || `EcoCash request failed (${res.status})`;
        logError("ecocash_initiate_rejected", new Error(message), { reference, status: res.status, data });
        return { success: false, reference, redirect_url: "", error: message };
      }

      // A charge request that comes back 200 means EIP accepted it and sent
      // the PIN prompt — the transaction itself is still pending until the
      // buyer responds, which is not a failure of *this* call.
      return { success: true, reference, redirect_url: "", ecocash_end_user_id: endUserId };
    } catch (error) {
      logError("ecocash_initiate", error, { reference });
      return { success: false, reference, redirect_url: "", error: "Failed to initiate EcoCash payment" };
    }
  }

  static async pollStatus(endUserId: string, clientCorrelator: string): Promise<"paid" | "failed" | "pending"> {
    const baseUrl = process.env.ECOCASH_EIP_BASE_URL || "";
    if (!baseUrl || !process.env.ECOCASH_EIP_USERNAME || !process.env.ECOCASH_EIP_PASSWORD) {
      throw new Error("EcoCash Instant Payment credentials are not configured");
    }

    const res = await fetch(`${baseUrl}/${encodeURIComponent(endUserId)}/transactions/amount/${encodeURIComponent(clientCorrelator)}`, {
      headers: EcocashService.requestHeaders(),
    });
    if (!res.ok) {
      if (res.status === 404) return "pending"; // not yet resolved on EcoCash's side
      throw new Error(`EcoCash lookup failed (${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    return EcocashService.classify(data);
  }
}

export { EcocashService };

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
