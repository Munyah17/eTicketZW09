// Incident response (2026-09-16): wipe EVERY user account, then create the
// single owner Super Admin. Requires the 20260916000000_super_admin_lockdown
// migration to be applied first (it provides emergency_delete_user and
// bootstrap_super_admin — the only code paths allowed past the protection
// triggers).
//
//   node --env-file=.env.local scripts/reset-all-users.mjs            (dry run)
//   node --env-file=.env.local scripts/reset-all-users.mjs --confirm  (applies)
//
// DESTRUCTIVE: every auth.users row is deleted. Because business tables
// reference profiles/events with NOT NULL FKs, all user-generated data is
// deleted too (events, tickets, ticket_types, gate_sales, passes, staff,
// organizers, payout methods, support tickets, wallet ledger). Financial
// history rows (payments, audit_logs, payout_requests, banners,
// platform_config) are preserved with their user references nulled.

import { createAdminClient, printTable } from "./_admin-client.mjs";

const OWNER = {
  email: "munyah777@gmail.com",
  username: "Munyah",
  name: "Munyah",
  password: "@@Griezmann177#$",
};

const confirm = process.argv.includes("--confirm");
const supabase = createAdminClient();

// ── 1. List every auth user ─────────────────────────────────────────────────
const allUsers = [];
let page = 1;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error("Failed to list users:", error.message); process.exit(1); }
  allUsers.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}

console.log(`auth.users accounts found: ${allUsers.length}`);
printTable(
  allUsers.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })),
  ["id", "email", "created_at"]
);

if (!confirm) {
  console.log("\nDry run — nothing was deleted. Re-run with --confirm to apply.");
  process.exit(0);
}

// ── 2. Delete user-generated data in FK-safe order ──────────────────────────
// Every statement deletes ALL rows (`.neq("id", NIL)` = match everything).
const NIL = "00000000-0000-0000-0000-000000000000";

async function wipe(table, column = "id") {
  const { error } = await supabase.from(table).delete().neq(column, NIL);
  if (error) {
    console.error(`Failed to wipe ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`wiped ${table}`);
}

async function nullify(table, columns, matchColumn = "id", matchValue = NIL) {
  const updates = Object.fromEntries(columns.map((c) => [c, null]));
  const { error } = await supabase.from(table).update(updates).neq(matchColumn, matchValue);
  if (error) {
    console.error(`Failed to nullify ${table}(${columns.join(",")}):`, error.message);
    process.exit(1);
  }
  console.log(`nullified ${table}(${columns.join(", ")})`);
}

console.log("\nDeleting user-generated data…");

// Leaf tables first — everything that references tickets/events/profiles.
await wipe("wallet_ledger");            // -> tickets, events, profiles
await wipe("service_provider_passes");  // -> events, profiles (NOT NULL issued_by)
await wipe("gate_sales");               // -> events, ticket_types, profiles (NOT NULL sold_by)
await wipe("tickets");                  // -> events, ticket_types, payments, profiles
await wipe("staff_members");            // -> organizers, profiles
await wipe("support_tickets");          // -> profiles
await wipe("organizer_payout_methods"); // -> organizers
await wipe("ticket_types");             // -> events
await wipe("event_custom_fields");      // -> events (cascade anyway, explicit for clarity)

// Preserve history rows — null their user/event references instead.
await nullify("payments", ["user_id", "event_id", "ticket_type_id"]);
await nullify("payout_requests", ["processed_by"]);
await nullify("audit_logs", ["actor_id"]);
await nullify("platform_config", ["updated_by"], "id", 0);
await nullify("banners", ["organizer_id"]);

// Now the parents.
await wipe("events");                   // -> profiles (NOT NULL organizer_id)
await wipe("organizers");               // -> profiles
await wipe("payout_requests");          // -> organizers (NOT NULL organizer_id)

// ── 3. Delete every auth user ───────────────────────────────────────────────
// super_admin rows need the emergency_delete_user RPC (protect_super_admin
// blocks the plain delete); everyone else goes through the admin API.
console.log("\nDeleting auth users…");
const { data: superAdmins } = await supabase
  .from("profiles")
  .select("id, email")
  .eq("role", "super_admin");
const superAdminIds = new Set((superAdmins ?? []).map((r) => r.id));

const failures = [];
for (const u of allUsers) {
  const { error } = superAdminIds.has(u.id)
    ? await supabase.rpc("emergency_delete_user", { p_user_id: u.id })
    : await supabase.auth.admin.deleteUser(u.id);
  if (error) failures.push({ email: u.email, id: u.id, error: error.message });
  else console.log(`deleted ${u.email ?? u.id}`);
}

if (failures.length > 0) {
  console.error("\nSome deletions failed:");
  printTable(failures, ["email", "id", "error"]);
  process.exit(1);
}

// ── 4. Create the owner Super Admin ─────────────────────────────────────────
console.log("\nCreating owner Super Admin…");
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email: OWNER.email,
  password: OWNER.password,
  email_confirm: true,
  user_metadata: { name: OWNER.name, role: "customer" }, // trigger allowlists customer/organizer
});
if (createError) {
  console.error("Failed to create auth user:", createError.message);
  process.exit(1);
}

// handle_new_user created the profile as 'customer'; set name/username, then
// promote via the bootstrap function (the only path past prevent_role_escalation).
const { error: profileError } = await supabase
  .from("profiles")
  .update({ name: OWNER.name, username: OWNER.username, verified: true })
  .eq("id", created.user.id);
if (profileError) {
  console.error("Failed to set profile fields:", profileError.message);
  process.exit(1);
}

const { error: bootstrapError } = await supabase.rpc("bootstrap_super_admin", {
  p_user_id: created.user.id,
});
if (bootstrapError) {
  console.error("Failed to promote to super_admin:", bootstrapError.message);
  process.exit(1);
}

await supabase.from("audit_logs").insert({
  actor_id: null,
  actor_email: "incident-response-script (local, service role)",
  action: "user.create",
  resource_type: "profile",
  resource_id: created.user.id,
  details: { email: OWNER.email, username: OWNER.username, reason: "security incident — full account reset, owner super admin re-seeded" },
});

console.log(`\nDone. Super Admin created: ${OWNER.email} (id ${created.user.id})`);
console.log("Sign in at /super-admin — TOTP 2FA enrollment is required on first login.");
