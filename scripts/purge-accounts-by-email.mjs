// Incident response: delete specific admin/super_admin accounts by email.
// Refuses to ever delete the protected owner email, no matter what's passed.
// Dry-run by default; nothing is deleted without --confirm.
//
//   node --env-file=.env.local scripts/purge-accounts-by-email.mjs a@x.com b@x.com           (dry run)
//   node --env-file=.env.local scripts/purge-accounts-by-email.mjs a@x.com b@x.com --confirm  (deletes)

import { createAdminClient, printTable } from "./_admin-client.mjs";

const PROTECTED_EMAIL = "munyah777@gmail.com";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const emails = args.filter((a) => a !== "--confirm");

if (emails.length === 0) {
  console.error("Usage: node scripts/purge-accounts-by-email.mjs <email> [email...] [--confirm]");
  process.exit(1);
}

if (emails.includes(PROTECTED_EMAIL)) {
  console.error(`Refusing to proceed: ${PROTECTED_EMAIL} is protected and was included in the target list.`);
  process.exit(1);
}

const supabase = createAdminClient();

const { data: targets, error: findError } = await supabase
  .from("profiles")
  .select("id, email, role, is_suspended")
  .in("email", emails);

if (findError) {
  console.error("Lookup failed:", findError.message);
  process.exit(1);
}

console.log(`Matched accounts (${targets.length} of ${emails.length} requested):`);
printTable(targets, ["id", "email", "role", "is_suspended"]);

const missing = emails.filter((e) => !targets.some((t) => t.email === e));
if (missing.length > 0) {
  console.log("\nNo profile found for:", missing.join(", "));
}

if (targets.length === 0) {
  console.log("\nNothing to delete.");
  process.exit(0);
}

if (!confirm) {
  console.log(`\nDry run — ${targets.length} account(s) above would be deleted. Re-run with --confirm to apply.`);
  process.exit(0);
}

const results = [];
for (const target of targets) {
  const { error } = await supabase.auth.admin.deleteUser(target.id);
  results.push({ email: target.email, role: target.role, id: target.id, status: error ? `FAILED: ${error.message}` : "deleted" });

  if (!error) {
    await supabase.from("audit_logs").insert({
      actor_id: null,
      actor_email: "incident-response-script (local, service role)",
      action: "user.delete",
      resource_type: "profile",
      resource_id: target.id,
      details: { email: target.email, role: target.role, reason: "security incident — rogue admin/super_admin purge" },
    });
  }
}

console.log("\nResults:");
printTable(results, ["email", "role", "id", "status"]);

const failures = results.filter((r) => r.status !== "deleted");
if (failures.length > 0) {
  console.error(`\n${failures.length} deletion(s) failed — see table above.`);
  process.exit(1);
}
