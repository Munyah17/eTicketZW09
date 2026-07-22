import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { validationUrl } from "@/lib/ticket-png";

export interface WristbandData {
  id: string;
  eventTitle: string;
  eventDate: string;
  ticketTypeName: string;
}

// Sized to print on standard adhesive event-wristband sheets (~1in tall,
// long strip) — a different physical format of the same ticket, not a new
// credential. Same validation QR as the ticket itself (lib/ticket-png.tsx),
// so either one admits the holder; this is purely a printing convenience.
const WIDTH = 1900;
const HEIGHT = 200;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "numeric" });
}

export async function renderWristbandPng(data: WristbandData): Promise<Buffer> {
  const validationCode = `ETKT-${data.id.slice(-8).toUpperCase()}`;
  const qrDataUrl = await QRCode.toDataURL(validationUrl(data.id), {
    width: 320,
    margin: 1,
    color: { dark: "#ffffff", light: "#dc2626" },
  });

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          alignItems: "center",
          background: "#dc2626",
          fontFamily: "sans-serif",
          padding: "0 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: 2, textTransform: "uppercase" }}>
            E-TicketsZW
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#ffffff" }}>
            {data.eventTitle}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.85)" }}>
            {formatDate(data.eventDate)} · {data.ticketTypeName}
          </div>
        </div>

        <div style={{ display: "flex", width: 3, height: 140, background: "rgba(255,255,255,0.3)", margin: "0 32px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} width={160} height={160} alt="" style={{ borderRadius: 8 }} />
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#ffffff", letterSpacing: 1 }}>
            {validationCode}
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
