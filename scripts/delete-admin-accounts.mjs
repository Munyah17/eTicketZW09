// Incident response: delete every role='admin' account. Never touches
// super_admin, organizer, customer, or staff rows — filtered strictly by
// role='admin'. Dry-run by default; nothing is deleted without --confirm.
//
//   node --env-file=.env.local scripts/delete-admin-accounts.mjs           (dry run)
//   node --env-file=.env.local scripts/delete-admin-accounts.mjs --confirm (deletes)

import { createAdminClient, printTable } from "./_admin-client.mjs";

const confirm = process.argv.includes("--confirm");
const supabase = createAdminClient();

const { data: targets, error: listError } = await supabase
  .from("profiles")
  .select("id, email, name, created_at")
  .eq("role", "admin")
  .order("created_at", { ascending: true });

if (listError) {
  console.error("Failed to list admin accounts:", listError.message);
  process.exit(1);
}

console.log(`role='admin' accounts (${targets.length}):`);
printTable(targets, ["id", "email", "name", "created_at"]);

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
  results.push({ email: target.email, id: target.id, status: error ? `FAILED: ${error.message}` : "deleted" });

  if (!error) {
    await supabase.from("audit_logs").insert({
      actor_id: null,
      actor_email: "incident-response-script (local, service role)",
      action: "user.delete",
      resource_type: "profile",
      resource_id: target.id,
      details: { email: target.email, reason: "security incident — bulk admin account cleanup" },
    });
  }
}

console.log("\nResults:");
printTable(results, ["email", "id", "status"]);

const failures = results.filter((r) => r.status !== "deleted");
if (failures.length > 0) {
  console.error(`\n${failures.length} deletion(s) failed — see table above.`);
  process.exit(1);
}
