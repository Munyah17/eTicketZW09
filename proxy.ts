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

// Paths that must stay reachable even in maintenance mode — admin panels (so
// staff can turn it back off), auth, and the API routes the admin panels
// need. /creator (organizers) intentionally does NOT bypass, matching
// today's behavior — organizers see the maintenance page like anyone else.
const MAINTENANCE_BYPASS_PREFIXES = ["/admin", "/private", "/login", "/super-admin", "/api"];

// The login surfaces — reachable while logged out, but redirected away
// from once already signed in as the matching role (handled below).
// /super-admin is the only Super Admin sign-in; /private/login is kept as a
// redirect for old links/bookmarks.
const ADMIN_LOGIN_PATH = "/admin/login";
const PRIVATE_LOGIN_PATH = "/private/login";
const SUPER_ADMIN_LOGIN_PATH = "/super-admin";

/**
 * Runs on every request.
 * Refreshes the Supabase Auth session cookie, and enforces site-wide
 * maintenance mode (Platform Config) for non-admin visitors.
 */
export async function proxy(request: NextRequest) {
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

    // Real, server-side role gate for the admin/super-admin portals — blocks
    // the page HTML/JS itself, not just a client-side "Access Denied" flash
    // after hydration. A Supabase session isn't scoped to which login page
    // issued it, so this check (not the separate /login, /admin/login,
    // /private/login pages) is what actually enforces the boundary between
    // portals.
    // Legacy Super Admin login URL — the real sign-in lives at /super-admin.
    if (path === PRIVATE_LOGIN_PATH) {
      return NextResponse.redirect(new URL(SUPER_ADMIN_LOGIN_PATH, request.url));
    }

    const isAdminPath = path.startsWith("/admin");
    const isPrivatePath = path.startsWith("/private");
    const isPortalLoginPath = path === ADMIN_LOGIN_PATH;

    if ((isAdminPath || isPrivatePath) && !isPortalLoginPath) {
      const loginPath = isPrivatePath ? SUPER_ADMIN_LOGIN_PATH : ADMIN_LOGIN_PATH;

      if (!user) {
        return NextResponse.redirect(new URL(loginPath, request.url));
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = profile?.role;
      const allowed = isPrivatePath ? role === "super_admin" : (role === "admin" || role === "super_admin");

      if (!allowed) {
        return NextResponse.redirect(new URL(loginPath, request.url));
      }

      // Super Admin sessions must be two-factor (aal2). A password-only
      // session (aal1) is sent back to /super-admin, which resumes at the
      // authenticator step — there is no path into either portal without
      // the second factor.
      if (role === "super_admin") {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== "aal2") {
          return NextResponse.redirect(new URL(SUPER_ADMIN_LOGIN_PATH, request.url));
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
