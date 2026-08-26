// Incident response: delete an auth.users row directly by email, for cases
// where the profiles row is already gone but the login credential remains.
//
//   node --env-file=.env.local scripts/_delete-auth-user-by-email.mjs <email>

import { createAdminClient } from "./_admin-client.mjs";

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/_delete-auth-user-by-email.mjs <email>"); process.exit(1); }

const supabase = createAdminClient();
const { data, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (listError) { console.error(listError.message); process.exit(1); }

const match = data.users.find((u) => u.email === email);
if (!match) { console.log(`No auth.users record for ${email}.`); process.exit(0); }

const { error } = await supabase.auth.admin.deleteUser(match.id);
console.log(error ? `FAILED: ${error.message}` : `Deleted auth.users record for ${email} (${match.id}).`);
if (error) process.exit(1);
