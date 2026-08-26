// Incident response: snapshot every admin/super_admin row before making any
// changes. Read-only.
//
//   node --env-file=.env.local scripts/check-privileged-accounts.mjs

import { createAdminClient, printTable } from "./_admin-client.mjs";

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("profiles")
  .select("id, email, role, is_suspended, created_at")
  .in("role", ["admin", "super_admin"])
  .order("role", { ascending: false })
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to list privileged accounts:", error.message);
  process.exit(1);
}

console.log(`Privileged accounts (${data.length}):`);
printTable(data, ["id", "email", "role", "is_suspended", "created_at"]);
