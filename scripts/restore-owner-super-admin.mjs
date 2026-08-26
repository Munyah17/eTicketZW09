// Incident response: restore the real owner's role and un-suspend them.
// Must run BEFORE the RLS-hardening migration is applied — afterward, no
// UPDATE (including from this service-role script) can ever set
// role='super_admin' again.
//
//   node --env-file=.env.local scripts/restore-owner-super-admin.mjs <email> --confirm

import { createAdminClient, printTable } from "./_admin-client.mjs";

const email = process.argv[2];
const confirm = process.argv.includes("--confirm");
if (!email) {
  console.error("Usage: node scripts/restore-owner-super-admin.mjs <email> --confirm");
  process.exit(1);
}

const supabase = createAdminClient();

const { data: before, error: findError } = await supabase
  .from("profiles")
  .select("id, email, role, is_suspended")
  .eq("email", email)
  .single();

if (findError || !before) {
  console.error(`No profile found for ${email}:`, findError?.message);
  process.exit(1);
}

console.log("Current state:");
printTable([before], ["id", "email", "role", "is_suspended"]);

if (!confirm) {
  console.log("\nWould set role='super_admin', is_suspended=false. Re-run with --confirm to apply.");
  process.exit(0);
}

const { data: after, error: updateError } = await supabase
  .from("profiles")
  .update({ role: "super_admin", is_suspended: false })
  .eq("id", before.id)
  .select("id, email, role, is_suspended")
  .single();

if (updateError) {
  console.error("Failed to restore account:", updateError.message);
  process.exit(1);
}

console.log("\nRestored:");
printTable([after], ["id", "email", "role", "is_suspended"]);

await supabase.from("audit_logs").insert({
  actor_id: null,
  actor_email: "incident-response-script (local, service role)",
  action: "user.role_change",
  resource_type: "profile",
  resource_id: before.id,
  details: { email, from: before, to: { role: "super_admin", is_suspended: false }, reason: "security incident — restore compromised owner account" },
});
