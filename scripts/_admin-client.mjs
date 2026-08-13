import { createClient } from "@supabase/supabase-js";

// Shared connection helper for the one-off incident-response scripts in this
// directory. Mirrors lib/supabase/admin.ts's createAdminClient() — service
// role, bypasses RLS. Requires NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. via
// `node --env-file=.env.local scripts/<script>.mjs`).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Run with: node --env-file=.env.local scripts/<script>.mjs"
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  console.table(rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))));
}
