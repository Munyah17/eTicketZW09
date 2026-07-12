const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Extracts the ticket identifier from whatever a scanner hands us.
 * Ticket QR codes have gone through three formats:
 *   1. current  — validation URL: https://…/validate?code=<uuid>
 *   2. legacy   — JSON: {"ticketId":"<uuid>","validationCode":"ETKT-…"}
 *   3. manual   — the raw uuid / ID number typed by staff
 */
export function normalizeTicketCode(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const param = url.searchParams.get("code") || url.searchParams.get("tid") || url.searchParams.get("ticket");
      if (param) return param.trim();
    } catch {
      // not a parseable URL — fall through to raw handling
    }
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { ticketId?: unknown };
      if (typeof parsed.ticketId === "string" && parsed.ticketId) return parsed.ticketId.trim();
    } catch {
      // not JSON — fall through to raw handling
    }
  }

  return text;
}
