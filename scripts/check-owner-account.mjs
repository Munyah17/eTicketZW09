// Incident response: look up one specific account by email, whatever its
// current role/state is. Read-only.
//
//   node --env-file=.env.local scripts/check-owner-account.mjs <email>

import { createAdminClient, printTable } from "./_admin-client.mjs";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/check-owner-account.mjs <email>");
  process.exit(1);
}

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("profiles")
  .select("id, email, role, is_suspended, verified, created_at")
  .eq("email", email);

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log(`No profiles row found for ${email}.`);
} else {
  printTable(data, ["id", "email", "role", "is_suspended", "verified", "created_at"]);
}

// Also check the underlying auth.users record directly, in case the
// profiles row is missing/detached but the auth account still exists.
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (authError) {
  console.error("Failed to list auth users:", authError.message);
  process.exit(1);
}
const match = authUsers.users.find((u) => u.email === email);
if (match) {
  console.log("\nauth.users record:");
  console.log({
    id: match.id,
    email: match.email,
    banned_until: match.banned_until ?? null,
    created_at: match.created_at,
    last_sign_in_at: match.last_sign_in_at,
    user_metadata: match.user_metadata,
  });
} else {
  console.log(`\nNo auth.users record found for ${email} either.`);
}
