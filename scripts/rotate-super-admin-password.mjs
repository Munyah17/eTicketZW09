// Incident response: rotate the Super Admin password.
//
// Run locally against production (never deployed as an API route, so
// nothing lingers reachable after use):
//
//   NEW_SUPER_ADMIN_PASSWORD='...' node --env-file=.env.local \
//     scripts/rotate-super-admin-password.mjs --user-id=<uuid> --confirm
//
// Always prints every super_admin row first — do not assume which one is
// legitimate, a breach may have created a rogue extra one.

import { createAdminClient } from "./_admin-client.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const supabase = createAdminClient();

const { data: superAdmins, error: listError } = await supabase
  .from("profiles")
  .select("id, email, created_at")
  .eq("role", "super_admin")
  .order("created_at", { ascending: true });

if (listError) {
  console.error("Failed to list super_admin accounts:", listError.message);
  process.exit(1);
}

console.log("Current super_admin accounts:");
console.table(superAdmins);

if (!args["user-id"]) {
  console.log("\nPass --user-id=<uuid> for the account to rotate, and --confirm to apply.");
  process.exit(0);
}

const target = superAdmins.find((r) => r.id === args["user-id"]);
if (!target) {
  console.error(`\nNo super_admin row found with id ${args["user-id"]}. Refusing to proceed.`);
  process.exit(1);
}

if (!args.confirm) {
  console.log(`\nWould rotate password for ${target.email} (${target.id}). Re-run with --confirm to apply.`);
  process.exit(0);
}

const newPassword = process.env.NEW_SUPER_ADMIN_PASSWORD;
if (!newPassword) {
  console.error("\nSet NEW_SUPER_ADMIN_PASSWORD in the environment before running with --confirm.");
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(target.id, {
  password: newPassword,
});

if (updateError) {
  console.error(`\nFailed to rotate password for ${target.email}:`, updateError.message);
  process.exit(1);
}

console.log(`\nPassword rotated for ${target.email} (${target.id}).`);
