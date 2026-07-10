# Engineering Log — Stabilisation Audit (2026-07-10/11)

Full audit of code, Vercel deployment, and the live Supabase database, followed by
structural fixes. Each section: problem → root cause → fix → verification.

---

## 0. Infrastructure audit results (no defects found here)

Checked first because "updates never reached users" suggested deployment drift:

- **Vercel ↔ GitHub**: production deployment is built from `main` HEAD. Not stale.
- **Production env**: `NEXT_PUBLIC_SUPABASE_URL` baked into the live JS bundle points
  at the correct Supabase project (`blafzslsinnhpztwmflt`). No split-brain database.
- **Auth roles in DB**: `profiles` has one `super_admin` and four `organizer`
  accounts. Role gating code (login redirect, admin/organizer layouts,
  `requireAdmin`/`requireSuperAdmin` API guards) is consistent and correct.

**Admin → client misrouting explanation**: routing is driven purely by
`profiles.role`. Any account that lands on the customer portal does so because its
role in this database is `customer`/`organizer` — e.g. `admin@globalspaceweb.co.zw`
is role `organizer`, not `admin`. Accounts created or promoted in another
IDE/database never existed here. Fix is data, not code: promote the intended
accounts via Super Admin → User Management (or SQL). No code change required.

## 1. The real "updates never reached users" root cause: migration drift

- **Problem**: features shipped in code but their DB schema was never applied to
  production. The live migration ledger stopped at 2026-07-05.
- **Root cause**: `20260708000000_add_organizer_payout_methods.sql` contained a
  CHECK constraint with a subquery — illegal in Postgres. The migration could never
  apply, and everything after it silently stalled. Some later changes were applied
  ad-hoc by hand (e.g. `pending_review` enum, `sold_out_at`), deepening the drift.
- **Fixes**:
  - Rewrote the payout-methods migration: removed the illegal CHECK (the max-5 rule
    already lives in the API route), added `ENABLE ROW LEVEL SECURITY` + an
    organizer-scoped policy (the API reads this table with the user session, so it
    was both broken *and* would have been world-writable without RLS).
  - Applied the missing migrations to production: `organizer_payout_methods` table
    (fixes the organizer payout-methods feature, previously 500ing) and the ticket
    delivery-tracking columns (`issued_at`, `email_delivered_at`,
    `whatsapp_delivered_at`, `delivery_log`).
  - Rewrote `supabase_migrations.schema_migrations` to match the repo's migration
    files 1:1 (22 rows), so `supabase db push` works cleanly from now on.
- **Verified**: information_schema checks confirm table + 4 columns exist; ledger
  count = 22.

## 2. Event featured images never displayed

- **Problem**: every event card shows the placeholder; `events.image` is `""` for
  all rows in production.
- **Root causes** (three stacked failures, all silent):
  1. `/api/organizer/events/image` imported the **browser** Supabase client into a
     server route — `getUser()` always null → every upload returned 401.
  2. The `events` storage bucket referenced by the route **did not exist** in
     Supabase (only `banners` did).
  3. The create-event page never checked the upload response — failures were
     swallowed, so organizers believed uploads succeeded.
- **Fixes**:
  - Route now imports `@/lib/supabase/server` (`app/api/organizer/events/image/route.ts`).
  - Created the `events` bucket live (public, 20MB, image mime types) + storage
    read policy, and added migration `20260710000000_create_events_storage_bucket.sql`.
  - Create page now checks `res.ok` and tells the organizer if the image failed.
  - My Events (`app/organizer/events/page.tsx`): added a per-row thumbnail and a
    working "add/replace featured image" action so existing image-less events can
    be repaired. Removed the Edit/Delete buttons that had **no handlers at all**
    (dead UI masquerading as functionality).
- **Verified**: uploaded a test PNG to the bucket via API and confirmed anonymous
  public read (HTTP 200), then deleted it. Build + lint pass.

## 3. Ticket fulfillment: Paynow webhook could never fire

- **Problem**: paid Paynow payments sat in "pending" until the super admin manually
  approved each one.
- **Root cause**: Paynow POSTs its result webhook as
  `application/x-www-form-urlencoded`; the handler called `req.json()`, so every
  real callback threw and returned 500. Additionally the handler trusted the POSTed
  `status` field blindly — no hash/server verification — meaning anyone who knew a
  payment reference could have minted a free ticket.
- **Fixes** (`app/api/payments/webhook/paynow/route.ts`, `lib/services/payment-service.ts`,
  `app/api/payments/status/route.ts`):
  - Webhook now parses both urlencoded and JSON bodies.
  - Paynow's `pollUrl` is stored in payment metadata at initiation; the webhook
    treats the POST purely as a wake-up signal and fetches the authoritative status
    from Paynow's own servers (`PaynowService.pollStatus`, host-validated against
    `paynow.co.zw` to prevent SSRF/forged-status attacks).
  - The buyer-facing status endpoint (`/api/payments/status`) now does the same
    direct Paynow verification for pending payments — mirroring the existing Stripe
    path — so fulfillment completes the moment the buyer lands on the confirmation
    page even if the webhook is missed entirely.
- **Note**: payments initiated before this deploy have no stored `pollUrl`; the
  webhook falls back to the `pollurl` field Paynow itself sends (still
  host-validated). Manual admin confirm remains available as the final fallback.

## 4. Fulfillment orchestrator wedge bug

- **Problem**: a payment could end up permanently "paid but no ticket".
- **Root cause**: `confirmPaid` marked the payment `paid` *before* generating the
  ticket, and its idempotency guard returned early for any already-paid payment. If
  generation failed once (bad metadata, transient DB error), every retry —
  webhook, status poll, admin confirm — returned "already processed" and the buyer
  never got a ticket.
- **Fix**: idempotency now keys on **ticket existence** (the real completion
  marker). A paid payment with no ticket resumes fulfillment instead of returning.
- **Verified**: unit tests + build pass; flow re-read end-to-end
  (webhook → confirmPaid → generateTicket → DB-persist check → email/WhatsApp push
  → delivery bookkeeping in the now-existing tracking columns).

## 5. Build reliability

- **Problem**: `next build` failed offline / with a flaky CDN.
- **Root cause**: the 🎟️ emoji in `app/opengraph-image.tsx` makes `next/og` fetch
  emoji artwork from cdn.jsdelivr.net at build time.
- **Fix**: replaced with an inline SVG ticket icon. Build is now hermetic.
- Also fixed a pre-existing `react/no-unescaped-entities` lint error in
  `app/admin/platform/page.tsx` (CI runs lint).

## Ticket delivery status (what the flow does today)

Payment verified (webhook, status poll, or admin manual confirm) →
`confirmPaid` → ticket row with QR code persisted and DB-verified → PNG rendered
(QR + dashed tear lines) → pushed to **email (Resend attachment)** and **WhatsApp
(Meta Cloud API)** in parallel → `issued_at`/`delivery_log` recorded → organizer +
admin sale notifications.

## Remaining risks / action items for the owner

1. **WhatsApp delivery is OFF**: `WHATSAPP_ACCESS_TOKEN` and
   `WHATSAPP_PHONE_NUMBER_ID` are not set in Vercel. Requires a Meta WhatsApp
   Business Cloud API account (only the owner can create it). Until then tickets
   deliver via email only. For business-initiated sends outside the 24h window an
   approved template + `WHATSAPP_TICKET_TEMPLATE` is also required.
2. **Email deliverability**: `RESEND_API_KEY` is set, but confirm the sending
   domain (`EMAIL_FROM`) is verified in the Resend dashboard; check
   Admin → System Health.
3. **Admin accounts**: promote the intended staff accounts to `admin` via Super
   Admin → User Management; that alone resolves the "admin routed to client
   portal" reports.
4. Vercel env vars only target Production — add Preview values if preview deploys
   are used.
5. One ticket row is generated per payment regardless of quantity purchased
   (single QR for multiple admits). Works, but gate-scan UX may want per-seat
   tickets later.
6. Organizer event **editing** doesn't exist (the old Edit button was dead UI).
   Featured-image add/replace is now available on My Events; full event editing is
   a future feature.
