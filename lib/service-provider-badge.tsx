import { ImageResponse } from "next/og";
import QRCode from "qrcode";

export interface ServiceProviderBadgeData {
  id: string;
  fullName: string;
  photoUrl: string;
  companyName: string;
  position: string;
  eventTitle: string;
  eventDate: string;
}

// Portrait, noticeably bigger than a standard ID card (85.6x54mm) — sized
// like an event lanyard badge insert so it reads clearly at a glance from
// a few feet away, not squinted at up close.
const WIDTH = 700;
const HEIGHT = 1000;

function verificationUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.eticket.co.zw").replace(/\/$/, "");
  return `${base}/verify-staff?code=${id}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZW", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Renders a Service Provider pass — event-day credential for personnel who
// never need a platform login (ushers, security, DJs, sound engineers...).
// Deliberately distinct visually from a paid ticket (lib/ticket-png.tsx) so
// gate staff can never mistake one for the other at a glance.
export async function renderServiceProviderBadge(data: ServiceProviderBadgeData): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(verificationUrl(data.id), {
    width: 260,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 36px",
          }}
        >
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#ffffff" }}>E-TicketsZW</div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              fontWeight: 700,
              color: "#0f172a",
              background: "#f59e0b",
              padding: "6px 16px",
              borderRadius: 999,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Event Staff
          </div>
        </div>

        {/* Photo */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 24px" }}>
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoUrl}
              width={260}
              height={260}
              alt=""
              style={{ borderRadius: 24, objectFit: "cover", border: "4px solid #f59e0b" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 260,
                height: 260,
                borderRadius: 24,
                background: "#1e293b",
                border: "4px solid #f59e0b",
              }}
            />
          )}
        </div>

        {/* Identity panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 40px",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#ffffff", textAlign: "center" }}>
            {data.fullName}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
              background: "#f59e0b",
              padding: "8px 22px",
              borderRadius: 999,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {data.position}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#94a3b8", marginTop: 8 }}>{data.companyName}</div>
        </div>

        <div style={{ display: "flex", height: 3, background: "#f59e0b", margin: "28px 40px" }} />

        {/* Event context */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", fontSize: 18, color: "#64748b", textTransform: "uppercase", letterSpacing: 2 }}>
            Providing Service To
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#ffffff", textAlign: "center", padding: "0 30px" }}>
            {data.eventTitle}
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#94a3b8" }}>{formatDate(data.eventDate)}</div>
        </div>

        {/* QR verification */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", paddingBottom: 32, gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} width={170} height={170} alt="Verification QR code" style={{ borderRadius: 12 }} />
          <div style={{ display: "flex", fontSize: 14, color: "#64748b" }}>Scan to verify this credential</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
