// Incident response: demote rogue super_admin accounts to customer first
// (protect_super_admin blocks deleting a super_admin row outright, and the
// new prevent_role_escalation trigger only allows role changes through this
// service-role client, not raw SQL), then delete them entirely. Refuses to
// ever touch the protected owner email.
//
//   node --env-file=.env.local scripts/demote-then-purge.mjs a@x.com b@x.com --confirm

import { createAdminClient, printTable } from "./_admin-client.mjs";

const PROTECTED_EMAIL = "munyamuzvidziwa19@gmail.com";
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const emails = args.filter((a) => a !== "--confirm");

if (emails.length === 0) {
  console.error("Usage: node scripts/demote-then-purge.mjs <email> [email...] [--confirm]");
  process.exit(1);
}
if (emails.includes(PROTECTED_EMAIL)) {
  console.error(`Refusing to proceed: ${PROTECTED_EMAIL} is protected.`);
  process.exit(1);
}

const supabase = createAdminClient();

const { data: targets, error: findError } = await supabase
  .from("profiles")
  .select("id, email, role")
  .in("email", emails);
if (findError) { console.error(findError.message); process.exit(1); }

console.log(`Matched (${targets.length} of ${emails.length}):`);
printTable(targets, ["id", "email", "role"]);

if (!confirm) {
  console.log("\nDry run — would demote to customer, then delete. Re-run with --confirm.");
  process.exit(0);
}

const results = [];
for (const target of targets) {
  if (target.role === "super_admin") {
    const { error: demoteError } = await supabase.from("profiles").update({ role: "customer" }).eq("id", target.id);
    if (demoteError) {
      results.push({ email: target.email, status: `DEMOTE FAILED: ${demoteError.message}` });
      continue;
    }
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(target.id);
  results.push({ email: target.email, status: deleteError ? `DELETE FAILED: ${deleteError.message}` : "deleted" });

  if (!deleteError) {
    await supabase.from("audit_logs").insert({
      actor_id: null,
      actor_email: "incident-response-script (local, service role)",
      action: "user.delete",
      resource_type: "profile",
      resource_id: target.id,
      details: { email: target.email, originalRole: target.role, reason: "security incident — rogue admin/super_admin purge" },
    });
  }
}

console.log("\nResults:");
printTable(results, ["email", "status"]);
