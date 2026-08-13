// Incident response: list every role='admin' account for review before
// deletion. Read-only — always safe to run.
//
//   node --env-file=.env.local scripts/list-admin-accounts.mjs

import { createAdminClient, printTable } from "./_admin-client.mjs";

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("profiles")
  .select("id, email, name, created_at")
  .eq("role", "admin")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to list admin accounts:", error.message);
  process.exit(1);
}

console.log(`role='admin' accounts (${data.length}):`);
printTable(data, ["id", "email", "name", "created_at"]);
