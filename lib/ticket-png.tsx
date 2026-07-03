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
}

const WIDTH = 900;
const HEIGHT = 1300;

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
// summary — as a single PNG buffer. Used for both the download button and
// the email attachment so the two are always identical.
export async function renderTicketPng(ticket: TicketPngData): Promise<Buffer> {
  const validationCode = `ETKT-${ticket.id.slice(-8).toUpperCase()}`;
  const qrDataUrl = await QRCode.toDataURL(
    JSON.stringify({ ticketId: ticket.id, validationCode }),
    { width: 320, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } }
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#dc2626",
            color: "#ffffff",
            padding: "36px 56px",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>E-TicketsZW</div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              background: "rgba(255,255,255,0.18)",
              padding: "10px 24px",
              borderRadius: 999,
            }}
          >
            {ticket.ticketTypeName}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "56px" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#0f172a" }}>
            {ticket.eventTitle}
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 18 }}>
            <div style={{ display: "flex", fontSize: 28, color: "#334155" }}>
              {formatDate(ticket.eventDate)} at {formatTime(ticket.eventTime)}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#334155" }}>{ticket.venue}</div>
          </div>

          <div style={{ display: "flex", borderTop: "3px dashed #cbd5e1", marginTop: 48, marginBottom: 48 }} />

          <div style={{ display: "flex", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} width={340} height={340} alt="Ticket QR code" />
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24, fontSize: 24, color: "#64748b" }}>
            {validationCode}
          </div>

          <div style={{ display: "flex", borderTop: "3px dashed #cbd5e1", marginTop: 48, marginBottom: 48 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
              <div style={{ display: "flex", color: "#64748b" }}>Ticket Holder</div>
              <div style={{ display: "flex", fontWeight: 600, color: "#0f172a" }}>
                {ticket.buyerDisplayName || ticket.buyerName}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
              <div style={{ display: "flex", color: "#64748b" }}>Ticket ID</div>
              <div style={{ display: "flex", fontWeight: 600, color: "#0f172a" }}>{ticket.id}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
              <div style={{ display: "flex", color: "#64748b" }}>Amount Paid</div>
              <div style={{ display: "flex", fontWeight: 600, color: "#0f172a" }}>
                {ticket.currency} {ticket.totalPaid.toFixed(2)} ({ticket.paymentMethod})
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
              <div style={{ display: "flex", color: "#64748b" }}>Purchased</div>
              <div style={{ display: "flex", fontWeight: 600, color: "#0f172a" }}>
                {new Date(ticket.purchasedAt).toLocaleDateString("en-ZW")}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", padding: "28px 56px", background: "#f1f5f9" }}>
          <div style={{ display: "flex", fontSize: 18, color: "#94a3b8" }}>
            Present this ticket (screen or print) at the venue entrance for admission.
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
