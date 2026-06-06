import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client — uses the service role key.
 *
 * ⚠️  BYPASSES Row Level Security.
 * Only use in:
 *   • API Route Handlers (app/api/**)
 *   • Server Actions
 *   • Background jobs
 *
 * NEVER import this in "use client" files or pass the client to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add them to .env.local — see .env.example for the full list."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
