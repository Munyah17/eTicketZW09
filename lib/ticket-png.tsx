import { ImageResponse } from "next/og";
import QRCode from "qrcode";

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
  totalPaid: number;
  currency: string;
  paymentMethod: string;
  purchasedAt: string;
  seatNumber?: string | null;
}

// Landscape ticket: main event panel on the left, perforated stub with the
// QR code on the right (vertical dashed tear line between them).
const WIDTH = 1600;
const HEIGHT = 640;

// Scanning the QR with any phone camera opens the eTicket confirmation check
// page; the in-app gate scanners extract the code from this URL server-side.
export function validationUrl(ticketId: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.eticket.co.zw").replace(/\/$/, "");
  return `${base}/validate?code=${ticketId}`;
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

// Renders a full ticket — branding, event details, QR code, and payment
// summary — as a single PNG buffer. Used for the download button, the email
// attachment, and the WhatsApp push so all three are always identical.
export async function renderTicketPng(ticket: TicketPngData): Promise<Buffer> {
  const validationCode = `ETKT-${ticket.id.slice(-8).toUpperCase()}`;
  const qrDataUrl = await QRCode.toDataURL(validationUrl(ticket.id), {
    width: 300,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const detail = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontSize: 17, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2 }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#0f172a" }}>{value}</div>
    </div>
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* ── Main panel ─────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
          {/* Brand band */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#dc2626",
              color: "#ffffff",
              padding: "26px 48px",
            }}
          >
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>E-TicketsZW</div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                background: "rgba(255,255,255,0.18)",
                padding: "8px 22px",
                borderRadius: 999,
              }}
            >
              {ticket.ticketTypeName}
            </div>
          </div>

          {/* Event branding */}
          <div style={{ display: "flex", flexDirection: "column", padding: "40px 48px", flexGrow: 1 }}>
            <div
              style={{
                display: "flex",
                fontSize: 52,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              {ticket.eventTitle}
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#334155", marginTop: 22 }}>
              {formatDate(ticket.eventDate)} at {formatTime(ticket.eventTime)}
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#334155", marginTop: 10 }}>
              {ticket.venue}
            </div>

            {/* Detail row */}
            <div style={{ display: "flex", gap: 56, marginTop: "auto", paddingTop: 32 }}>
              {detail("Ticket Holder", ticket.buyerDisplayName || ticket.buyerName)}
              {ticket.seatNumber ? detail("Seat", ticket.seatNumber) : null}
              {detail("Amount Paid", `${ticket.currency} ${ticket.totalPaid.toFixed(2)}`)}
              {detail("Purchased", new Date(ticket.purchasedAt).toLocaleDateString("en-ZW"))}
            </div>
          </div>

          {/* Footer strip */}
          <div style={{ display: "flex", padding: "18px 48px", background: "#f1f5f9" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#94a3b8" }}>
              Ticket ID {ticket.id} · Present this ticket (screen or print) at the venue entrance. Unique to you — do not share.
            </div>
          </div>
        </div>

        {/* ── Tear line ─────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            width: 0,
            borderLeft: "4px dashed #cbd5e1",
            margin: "24px 0",
          }}
        />

        {/* ── Stub ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            background: "#f8fafc",
            padding: "32px 24px",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              color: "#dc2626",
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            Admit One
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} width={280} height={280} alt="Ticket QR code" />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
            {validationCode}
          </div>
          {ticket.seatNumber ? (
            <div style={{ display: "flex", fontSize: 22, color: "#334155" }}>
              Seat {ticket.seatNumber}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 15, color: "#94a3b8", textAlign: "center" }}>
            Scan to verify with E-TicketsZW
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
