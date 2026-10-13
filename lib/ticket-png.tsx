import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import fs from "node:fs";
import path from "node:path";

export interface TicketPngData {
  id: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  ticketTypeName: string;
  buyerName: string;
  buyerDisplayName: string;
  buyerEmail: string;
  buyerContact?: string;
  idNumber?: string | null;
  receiverName?: string | null;
  totalPaid: number;
  currency: string;
  paymentMethod: string;
  purchasedAt: string;
  seatNumber?: string | null;
  ticketNumber?: string | null;
  batchId?: string | null;
  admitCount?: number;
  partyComposition?: { adults?: number; children?: number; seniors?: number };
  attendees?: { name: string; idNumber?: string; ageGroup?: string; address?: string }[];
}

// Landscape ticket: main event panel on the left, perforated stub with the
// QR code on the right (vertical dashed tear line between them).
const WIDTH = 1600;
const HEIGHT = 640;

// Navy palette — matches the approved mockup, no red anywhere.
const NAVY = "#0a1428";
const NAVY_LIGHT = "#0e1d38";
const BLUE = "#3b82f6";
const BLUE_DIM = "#2563eb";
const LABEL = "#7a8db5";
const VALUE = "#ffffff";
const MUTED = "#5a6f94";
const HAIRLINE = "rgba(255,255,255,0.09)";

// Scanning the QR with any phone camera opens the eTicket confirmation check
// page; the in-app gate scanners extract the code from this URL server-side.
export function validationUrl(ticketId: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.eticket.co.zw").replace(/\/$/, "");
  return `${base}/validate?code=${ticketId}`;
}

// The batch barcode on every ticket in a purchase encodes this URL — one
// scan pulls up every individual ticket in the batch for the gate.
export function batchValidationUrl(batchId: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.eticket.co.zw").replace(/\/$/, "");
  return `${base}/validate?batch=${batchId}`;
}

// The eTicketZW lockup, embedded as a data URL so ImageResponse can render
// it without a network fetch. Read once and cached for the process.
let logoDataUrl: string | null = null;
function getLogo(): string | null {
  if (logoDataUrl) return logoDataUrl;
  try {
    const file = path.join(process.cwd(), "public", "logo-lockup-dark.png");
    logoDataUrl = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    logoDataUrl = null;
  }
  return logoDataUrl;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZW", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes ?? "00"} ${ampm}`;
}

// Small stroke icons for the info row — satori renders inline SVG fine.
const icon = (d: string) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  calendar: icon("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  clock: icon("M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"),
  pin: icon("M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"),
};

// Rule icons on the stub — tiny circles with a glyph + label beneath.
const rule = (glyph: string, label: string) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 78 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 999,
        border: `2px solid ${HAIRLINE}`,
        color: MUTED,
        fontSize: 19,
      }}
    >
      {glyph}
    </div>
    <div style={{ display: "flex", fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
  </div>
);

// Renders a full ticket — branding, event details, QR code, batch barcode,
// and payment summary — as a single PNG buffer. Used for the download
// button, the email attachment, and the WhatsApp push so all three are
// always identical.
export async function renderTicketPng(ticket: TicketPngData): Promise<Buffer> {
  const ticketNumber = ticket.ticketNumber || `ETKT-${ticket.id.slice(-8).toUpperCase()}`;
  const admitCount = ticket.admitCount || 1;
  const comp = ticket.partyComposition ?? {};
  const compParts = [
    comp.adults ? `${comp.adults} adult${comp.adults > 1 ? "s" : ""}` : null,
    comp.children ? `${comp.children} child${comp.children > 1 ? "ren" : ""}` : null,
    comp.seniors ? `${comp.seniors} senior${comp.seniors > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  const qrDataUrl = await QRCode.toDataURL(validationUrl(ticket.id), {
    width: 300,
    margin: 1,
    color: { dark: "#0a1428", light: "#ffffff" },
  });

  // Batch barcode — a linear Code128 (visually distinct from the QR so gate
  // staff know which to scan for what). Encodes the batch URL: one scan
  // lists every ticket in the purchase, each individually verifiable.
  let batchBarcodeUrl: string | null = null;
  if (ticket.batchId) {
    try {
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: batchValidationUrl(ticket.batchId),
        scale: 2,
        height: 10,
        includetext: false,
        backgroundcolor: "FFFFFF",
        barcolor: "0A1428",
      });
      batchBarcodeUrl = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      batchBarcodeUrl = null;
    }
  }

  const detail = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", fontSize: 15, color: LABEL, textTransform: "uppercase", letterSpacing: 2 }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 21, fontWeight: 600, color: VALUE }}>{value}</div>
    </div>
  );

  const logo = getLogo();

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* ── Main panel ─────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, padding: "40px 48px" }}>
          {/* Header: logo + ticket type badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} height={42} alt="eTicketZW" />
            ) : (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: VALUE }}>
                eTicketZW
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 600,
                color: "#ffffff",
                background: BLUE_DIM,
                padding: "8px 24px",
                borderRadius: 999,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {ticket.ticketTypeName}
            </div>
          </div>

          {/* Event title + tagline */}
          <div style={{ display: "flex", fontSize: 50, fontWeight: 700, color: VALUE, lineHeight: 1.1, marginTop: 34 }}>
            {ticket.eventTitle}
          </div>
          <div style={{ display: "flex", fontSize: 19, color: LABEL, marginTop: 10 }}>
            Official e-ticket — present at the gate for entry
          </div>

          {/* Date / time / venue with icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {ICONS.calendar}
              <div style={{ display: "flex", fontSize: 21, color: VALUE }}>{formatDate(ticket.eventDate)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {ICONS.clock}
              <div style={{ display: "flex", fontSize: 21, color: VALUE }}>{formatTime(ticket.eventTime)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {ICONS.pin}
              <div style={{ display: "flex", fontSize: 21, color: VALUE }}>{ticket.venue}</div>
            </div>
          </div>

          {/* Details grid — 3 columns separated by hairlines */}
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              paddingTop: 26,
              borderTop: `1px solid ${HAIRLINE}`,
              gap: 36,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              {detail("Ticket Holder", ticket.buyerDisplayName || ticket.buyerName)}
              {ticket.receiverName ? detail("Receiver", ticket.receiverName) : null}
              {ticket.idNumber ? detail("ID Number", ticket.idNumber) : null}
            </div>
            <div style={{ display: "flex", width: 0, borderLeft: `1px solid ${HAIRLINE}` }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              {detail("Section", ticket.ticketTypeName)}
              {ticket.seatNumber ? detail("Seat Number", ticket.seatNumber) : null}
              {detail("Admits", admitCount > 1 ? `${admitCount} people${compParts ? ` (${compParts})` : ""}` : "1 person")}
            </div>
            <div style={{ display: "flex", width: 0, borderLeft: `1px solid ${HAIRLINE}` }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              {detail("Amount Paid", `${ticket.currency} ${ticket.totalPaid.toFixed(2)}`)}
              {detail("Payment Method", ticket.paymentMethod)}
              {detail("Order ID", ticketNumber)}
            </div>
          </div>
        </div>

        {/* ── Perforation ───────────────────────────────────────── */}
        <div style={{ display: "flex", position: "relative", width: 0 }}>
          <div
            style={{
              display: "flex",
              width: 0,
              borderLeft: `3px dashed ${MUTED}`,
              margin: "28px 0",
            }}
          />
          {/* Notch circles — punched out of the ticket edge */}
          <div style={{ display: "flex", position: "absolute", top: -18, left: -14, width: 30, height: 30, borderRadius: 999, background: "#000000" }} />
          <div style={{ display: "flex", position: "absolute", bottom: -18, left: -14, width: 30, height: 30, borderRadius: 999, background: "#000000" }} />
          {/* TEAR HERE running down the perforation */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: HEIGHT / 2 - 60,
              left: -44,
              width: 90,
              justifyContent: "center",
              fontSize: 13,
              letterSpacing: 4,
              color: MUTED,
              transform: "rotate(-90deg)",
              textTransform: "uppercase",
            }}
          >
            Tear here
          </div>
        </div>

        {/* ── Stub ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 400,
            padding: "30px 28px",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              color: BLUE,
              letterSpacing: 7,
              textTransform: "uppercase",
            }}
          >
            {admitCount > 1 ? `Admit ${admitCount}` : "Admit One"}
          </div>
          <div style={{ display: "flex", fontSize: 12, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>
            Present this ticket at the gate
          </div>

          {/* QR on a white card */}
          <div style={{ display: "flex", background: "#ffffff", padding: 12, borderRadius: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} width={210} height={210} alt="Ticket QR code" />
          </div>

          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: VALUE, letterSpacing: 1 }}>
            {ticketNumber}
          </div>

          {/* Batch barcode — scans to every ticket in this purchase */}
          {batchBarcodeUrl ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ display: "flex", background: "#ffffff", padding: "6px 10px", borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={batchBarcodeUrl} height={44} alt="Batch barcode" />
              </div>
              <div style={{ display: "flex", fontSize: 11, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>
                Batch — scans all tickets in this order
              </div>
            </div>
          ) : null}

          {/* House rules icons */}
          <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
            {rule("↩", "No re-entry")}
            {rule("✕", "No cameras")}
            {rule("!", "No alcohol")}
            {rule("◷", "Arrive early")}
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
