// Incident response: list every role='staff' account for manual review.
// Read-only — no deletion path in this script. 'staff' belongs to an
// organizer's own gate/ticket-seller staff, not the platform-admin chain,
// so this is a lower-priority check, not an assumed-compromised list.
//
//   node --env-file=.env.local scripts/list-staff-accounts.mjs

import { createAdminClient, printTable } from "./_admin-client.mjs";

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("profiles")
  .select("id, email, name, organizer_id, created_at")
  .eq("role", "staff")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to list staff accounts:", error.message);
  process.exit(1);
}

console.log(`role='staff' accounts (${data.length}):`);
printTable(data, ["id", "email", "name", "organizer_id", "created_at"]);
