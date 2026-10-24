// Canonical public origin for outbound links — payment return/result URLs,
// email links, admin-redirect URLs. Must never be localhost or the apex
// domain: the live site and its Supabase cookies/redirect allow-list live on
// https://www.eticket.co.zw.
//
// Resolution order: explicit env → forwarded host headers (Vercel) → the
// request's own host → hardcoded production fallback.
const PRODUCTION_URL = "https://www.eticket.co.zw";

export function getSiteUrl(req?: {
  headers: { get(name: string): string | null };
  nextUrl?: { host: string };
}): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env) && !env.includes("localhost")) {
    return env.replace(/\/$/, "");
  }
  if (req) {
    const host =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl?.host;
    if (host) {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
    }
  }
  return PRODUCTION_URL;
}
