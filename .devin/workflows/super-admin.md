---
description: How to reset all user accounts and provision the owner Super Admin with TOTP 2FA
---

# Super Admin account reset + 2FA

The platform has exactly one owner Super Admin:

- **Login URL:** `/super-admin` (legacy `/private/login` redirects here)
- **Username:** `Munyah`
- **Email:** `munyah777@gmail.com`
- **2FA:** TOTP (Google Authenticator or any authenticator app) — enrollment is forced on first sign-in; the proxy rejects any super_admin session below `aal2`.

## One-time setup (run once against production)

1. Apply the lockdown migration (adds `emergency_delete_user` + `bootstrap_super_admin`, makes the owner account undeletable/un-suspendable):

   ```
   supabase db push
   ```

   or paste `supabase/migrations/20260916000000_super_admin_lockdown.sql` into the Supabase SQL editor.

2. Enable TOTP in the Supabase dashboard: **Authentication → Sign In / Providers → Multi-Factor Authentication → TOTP** (enroll + verify). Local dev already has it enabled via `supabase/config.toml`.

3. Wipe every account and seed the owner (dry run first, then apply):

   ```
   node --env-file=.env.local scripts/reset-all-users.mjs
   node --env-file=.env.local scripts/reset-all-users.mjs --confirm
   ```

   DESTRUCTIVE: deletes all auth users and all user-generated data (events, tickets, gate sales, staff, organizers, support tickets, wallet ledger). Payments, audit logs, payout requests, banners and platform config are kept with user references nulled.

4. Sign in at `/super-admin` with the email/username + password, scan the QR code with Google Authenticator, enter the 6-digit code.

## Guarantees (enforced by DB triggers, not app code)

- `munyah777@gmail.com` can never be deleted — even via the service role or the emergency delete function.
- No super_admin can be suspended; the last super_admin can never be demoted.
- Promotion to super_admin is only possible through `bootstrap_super_admin()`, which refuses once a super_admin exists.
- Deleting a super_admin is only possible through `emergency_delete_user()` (service role only) — and it still refuses the owner email.

## If locked out of the authenticator

The TOTP factor lives on the auth user. To reset it, delete the factor in the Supabase dashboard (Authentication → Users → select user → Factors) — the next `/super-admin` sign-in will re-enroll a fresh factor after the password check.
