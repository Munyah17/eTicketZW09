import { ImageResponse } from "next/og";

export const alt = "E-TicketsZW — Zimbabwe's Premier Event Ticketing Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #1d4ed8 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "rgba(255,255,255,0.15)",
              fontSize: 48,
            }}
          >
            🎟️
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#ffffff" }}>
            E-Tickets<span style={{ color: "#93c5fd" }}>ZW</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#dbeafe", textAlign: "center", maxWidth: 900 }}>
          Zimbabwe&apos;s Premier Event Ticketing Platform
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#bfdbfe", marginTop: 20 }}>
          Concerts · Comedy · Sports · Festivals
        </div>
      </div>
    ),
    { ...size }
  );
}
