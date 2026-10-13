import { randomInt } from "crypto";

// Human-facing ticket number printed on the ticket and typed at the gate.
//
// Format: ET-DDMMYY-XXXXX
//   ET      — eTicket brand prefix
//   DDMMYY  — purchase date (18 Sep 2026 → 180926)
//   XXXXX   — 5 crypto-random alphanumeric chars (A-Z0-9, ~60M combos)
//
// The date segment makes a number glanceable ("when was this bought?") while
// the random tail keeps it unguessable — sequential or derived codes are how
// counterfeits get minted. randomInt is CSPRNG, not Math.random.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateTicketNumber(purchaseDate: Date = new Date()): string {
  const dd = String(purchaseDate.getDate()).padStart(2, "0");
  const mm = String(purchaseDate.getMonth() + 1).padStart(2, "0");
  const yy = String(purchaseDate.getFullYear()).slice(-2);

  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `ET-${dd}${mm}${yy}-${suffix}`;
}

// Loose matcher for gate lookup — accepts the dashed form or a squashed
// "ET1809269OY64" so staff can type it either way.
export function looksLikeTicketNumber(code: string): boolean {
  return /^ET-?\d{6}-?[A-Z0-9]{5}$/i.test(code.trim());
}

export function normalizeTicketNumber(code: string): string {
  const squashed = code.trim().toUpperCase().replace(/-/g, "");
  // ET + 6 date digits + 5 random = 13 chars squashed → re-dash it.
  if (squashed.length === 13) {
    return `${squashed.slice(0, 2)}-${squashed.slice(2, 8)}-${squashed.slice(8)}`;
  }
  return code.trim().toUpperCase();
}
