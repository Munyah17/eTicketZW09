// Verification: proves the full super-admin 2FA chain works end-to-end —
// password sign-in (aal1) → TOTP enroll → challenge → verify (aal2) →
// unenroll, leaving the account clean so the real first login enrolls fresh.
// Read-only in effect: nothing persists after this script runs.
//
//   node --env-file=.env.local scripts/verify-super-admin-mfa.mjs

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const EMAIL = "munyah777@gmail.com";
const PASSWORD = "@@Griezmann177#$";

// Minimal RFC 6238 TOTP (SHA-1, 30s step, 6 digits) — same algorithm Google
// Authenticator uses, so a passing verify here means the real app will work.
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpCode(secret) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]) %
    1_000_000;
  return String(code).padStart(6, "0");
}

const supabase = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(step, err) {
  console.error(`FAIL at ${step}:`, err?.message ?? err);
  process.exit(1);
}

// 1. Password sign-in — should land at aal1.
const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (signInError || !signIn.user) fail("signInWithPassword", signInError);
console.log(`signed in: ${signIn.user.email} (${signIn.user.id})`);

const { data: aal1 } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
console.log(`assurance level after password: ${aal1?.currentLevel}`);
if (aal1?.currentLevel !== "aal1") fail("aal check", `expected aal1, got ${aal1?.currentLevel}`);

// 2. Enroll a TOTP factor.
const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
  factorType: "totp",
  friendlyName: "verify-script",
});
if (enrollError || !enroll) fail("mfa.enroll", enrollError);
console.log(`enrolled factor ${enroll.id} (secret length ${enroll.totp.secret.length})`);

// 3. Challenge + verify with a locally computed code.
const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
  factorId: enroll.id,
});
if (challengeError || !challenge) fail("mfa.challenge", challengeError);

const code = totpCode(enroll.totp.secret);
const { error: verifyError } = await supabase.auth.mfa.verify({
  factorId: enroll.id,
  challengeId: challenge.id,
  code,
});
if (verifyError) fail("mfa.verify", verifyError);
console.log("TOTP code verified");

// 4. Session must now be aal2 — this is what proxy.ts gates /private on.
const { data: aal2 } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
console.log(`assurance level after verify: ${aal2?.currentLevel}`);
if (aal2?.currentLevel !== "aal2") fail("aal check", `expected aal2, got ${aal2?.currentLevel}`);

// 5. Unenroll — leave the account with zero factors so the real first login
//    at /super-admin does the QR enrollment.
const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: enroll.id });
if (unenrollError) fail("mfa.unenroll", unenrollError);
console.log("factor unenrolled — account left clean");

await supabase.auth.signOut();
console.log("\nPASS — full 2FA chain works: password → enroll → verify → aal2.");
