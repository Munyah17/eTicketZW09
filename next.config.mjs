import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Event/banner images are uploaded to Supabase Storage (events & banners
    // buckets) and served from <ref>.supabase.co — allowlist that host so
    // next/image can resize + serve modern formats (WebP/AVIF) instead of the
    // full-resolution originals. Local /public assets need no pattern.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    // Reasonable defaults: cap the largest served width and let Next pick
    // formats per browser. minimumCacheTTL keeps optimized variants warm.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },
  // jspdf (PDF export) is only ever dynamically imported client-side, but its
  // fflate dependency contains a Node-only Worker() call that breaks the SSR
  // bundle if Turbopack tries to trace it. Keep it external so it's resolved
  // at runtime in the browser instead.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  async redirects() {
    return [
      // The browse-all-events page moved to /allevents — exact match only,
      // so /events/[id] detail pages are untouched. Query params (e.g.
      // ?category=music) are forwarded automatically.
      { source: "/events", destination: "/allevents", permanent: true },
    ]
  },
}

export default nextConfig
