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
    unoptimized: true,
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
