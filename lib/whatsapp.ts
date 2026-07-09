import { renderTicketPng, TicketPngData } from "@/lib/ticket-png";
import { logError } from "@/lib/error-logger";

// WhatsApp ticket delivery via the Meta WhatsApp Business Cloud API.
// Requires:
//   WHATSAPP_ACCESS_TOKEN     — permanent System User token for the WABA
//   WHATSAPP_PHONE_NUMBER_ID  — the business phone number ID (not the number itself)
// Optional:
//   WHATSAPP_TICKET_TEMPLATE  — approved utility template name. Business-initiated
//     conversations outside the 24h service window REQUIRE an approved template;
//     when set, the ticket is sent through it (image header + 2 body params:
//     buyer name, event title). Without it we attempt a free-form image message,
//     which only lands if the buyer messaged the business in the last 24 hours.

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export interface WhatsAppSendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

// Normalize Zimbabwean numbers to E.164 without the plus (what wa API expects).
// "0773909307" → "263773909307", "+263 77 390 9307" → "263773909307".
export function normalizeZimPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("263") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `263${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `263${digits}`;
  // Non-Zimbabwean international number already in E.164-ish form
  if (digits.length >= 11) return digits;
  return null;
}

async function uploadTicketMedia(phoneNumberId: string, token: string, png: Buffer, ticketId: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "image/png");
  form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), `ticket-${ticketId}.png`);

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.id) {
    throw new Error(`WhatsApp media upload failed (${res.status}): ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
  return json.id as string;
}

async function sendMessage(phoneNumberId: string, token: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`WhatsApp send failed (${res.status}): ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
}

// Pushes the generated ticket PNG to the buyer's WhatsApp. Never throws —
// returns a result the fulfillment orchestrator records as proof of delivery.
export async function sendTicketWhatsApp(
  ticket: TicketPngData,
  buyerPhone: string
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    logError("ticket_whatsapp_not_configured", new Error("WhatsApp Cloud API credentials missing"), {
      ticketId: ticket.id,
    });
    return { sent: false, skipped: true, error: "WhatsApp API not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  }

  const to = normalizeZimPhone(buyerPhone);
  if (!to) {
    return { sent: false, skipped: true, error: `No valid buyer phone number ("${buyerPhone}")` };
  }

  try {
    const png = await renderTicketPng(ticket);
    const mediaId = await uploadTicketMedia(phoneNumberId, token, png, ticket.id);

    const template = process.env.WHATSAPP_TICKET_TEMPLATE;
    if (template) {
      await sendMessage(phoneNumberId, token, {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: [
            { type: "header", parameters: [{ type: "image", image: { id: mediaId } }] },
            {
              type: "body",
              parameters: [
                { type: "text", text: ticket.buyerDisplayName || ticket.buyerName },
                { type: "text", text: ticket.eventTitle },
              ],
            },
          ],
        },
      });
    } else {
      await sendMessage(phoneNumberId, token, {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
          id: mediaId,
          caption:
            `🎟️ Your E-TicketsZW ticket for ${ticket.eventTitle}\n` +
            `Ticket ID: ${ticket.id}\n` +
            `Present this at the venue entrance. Please don't forward it — it's unique to you.`,
        },
      });
    }

    console.log("✓ Ticket pushed to WhatsApp:", to, "ticket:", ticket.id);
    return { sent: true };
  } catch (err) {
    logError("ticket_whatsapp_send_failed", err, { ticketId: ticket.id, to });
    return { sent: false, error: err instanceof Error ? err.message : "WhatsApp send failed" };
  }
}
