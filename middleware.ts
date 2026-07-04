import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Under Maintenance | E-TicketsZW</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; text-align: center; }
    div { max-width: 480px; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <div>
    <h1>We&apos;ll be right back</h1>
    <p>E-TicketsZW is undergoing scheduled maintenance. Please check back shortly.</p>
  </div>
</body>
</html>`;

// Paths that must stay reachable even in maintenance mode — admin panel (so
// staff can turn it back off), auth, and the API routes the admin panel needs.
const MAINTENANCE_BYPASS_PREFIXES = ["/admin", "/login", "/api"];

/**
 * Runs on every request.
 * Refreshes the Supabase Auth session cookie, and enforces site-wide
 * maintenance mode (Platform Config) for non-admin visitors.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refresh session — do not remove this line
    const { data: { user } } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const bypassesMaintenance = MAINTENANCE_BYPASS_PREFIXES.some((p) => path.startsWith(p));

    if (!bypassesMaintenance) {
      const { data: config } = await supabase.from("platform_config").select("maintenance_mode").eq("id", 1).single();

      if (config?.maintenance_mode) {
        let isAdmin = false;
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
          isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
        }

        if (!isAdmin) {
          return new NextResponse(MAINTENANCE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html", "Retry-After": "3600" },
          });
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
