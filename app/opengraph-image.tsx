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
            }}
          >
            {/* Inline ticket icon — emoji would make next/og fetch artwork
                from a CDN at build time, which breaks offline/flaky builds */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
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
