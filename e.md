# Codebase Inefficiencies & Tech Debt

> Findings from codebase audit. Fix in priority order.

---

## CRITICAL — Fix Immediately

### 1. `/api/admin/users` has no auth check
**File:** `app/api/admin/users/route.ts` — all handlers  
Any unauthenticated client can call GET/POST/PATCH/DELETE. The route uses the service-role admin client which bypasses RLS. Anyone who finds the endpoint can create, modify or delete every user account.  
**Fix:** Verify the caller is an admin/super_admin via Supabase session cookie before executing any operation.

---

## HIGH — Causes Real Egress Cost or Compliance Risk

### 2. Full-table selects on every page load — no pagination
**Files:**  
- `lib/events-store.ts` — `getStoredEvents()`, `getPublishedEvents()`, `getOrganizerEvents()`, `getEventsByCategory()` all use `select("*, ticket_types(*)")` with no `.range()` or `.limit()`  
- `app/api/admin/users/route.ts` — `select("*")` with no limit  

Supabase bills per row transferred. As events/users grow this becomes expensive and slow.  
**Fix:** Add `.limit(n)` to all queries. Implement cursor/offset pagination for admin list views.

### 3. Audit log is localStorage-only
**File:** `lib/audit-logger.ts`  
Audit entries capped at 500, stored in browser localStorage. Logs are lost on browser clear, not centralized, easily tampered with by the user, and not compliant with any audit standard.  
**Fix:** POST audit entries to a server API route that inserts into the existing `audit_logs` Supabase table.

---

## MEDIUM — Unnecessary Egress or Functional Gap

### 4. Support page fetches all users on every mount
**File:** `app/admin/support/page.tsx` lines 57-73  
`useEffect` fires on mount and loads every user via `/api/admin/users` even when the lookup input is never touched.  
**Fix:** Fetch users lazily — only when the search button is clicked or the input is focused.

### 5. Suspension state is client-only (localStorage)
**File:** `app/admin/users/page.tsx` lines 40-54  
Suspended user IDs are stored in the admin's browser. Suspension is invisible to other admins and lost when localStorage is cleared. The `profiles` table has no `suspended` column.  
**Fix:** Add `suspended boolean default false` to the `profiles` table. Read/write it via the admin API.

### 6. Custom DOM event + refetch pattern is redundant
**Files:** `lib/events-store.ts:7`, `app/admin/page.tsx:43`, `components/home/event-sections.tsx:67`  
After a DB write, `eticket:events-updated` fires, which triggers a full `getStoredEvents()` refetch. The freshly written data is immediately re-read from Supabase, causing a round-trip that could be avoided by returning the saved object from `saveEvent()` and updating state directly.  
**Fix:** Return the saved `Event` from `saveEvent()` and update local state optimistically. Keep the DOM event only as a cross-tab signal.

### 7. Console.log leaks payment session details into server logs
**Files:**  
- `app/api/payments/status/route.ts:36`  
- `app/api/payments/webhook/stripe/route.ts` (multiple)  
Payment intent IDs, session IDs, and statuses are logged at INFO level. These appear in hosting provider logs (Vercel, etc.) which may be retained or indexed.  
**Fix:** Remove or reduce payment-detail logs. Keep only error paths with `console.error`.

### 8. PATCH `/api/admin/users` accepts any role string
**File:** `app/api/admin/users/route.ts` lines 42-51  
No validation that `role` is one of the allowed enum values. Any string is written directly to the DB.  
**Fix:** Validate role against the `user_role` enum: `['super_admin','admin','organizer','staff','customer']`.

---

## LOW — Bad Pattern, Small Impact Now

### 9. Admin dashboard does client-side O(n×m) organizer-events join
**File:** `app/admin/page.tsx` lines 324-328  
For each organizer row, events are filtered with `events.filter(e => e.organizerId === ...)`. Fine for small data but should be a DB join or a pre-computed Map.

### 10. No debounce on the refresh button
**File:** `app/admin/users/page.tsx:235`  
Rapid clicks trigger multiple simultaneous fetches. Disable the button while `loading === true`.

### 11. `SUPER_ADMIN_EMAIL` exported from client context file
**File:** `lib/auth-context.tsx:41`  
The super admin email is compiled into the browser bundle and visible in devtools. Privilege checks should be based on the `role` column from the DB, not email string comparison.

### 12. No error feedback after role-change or delete mutations
**File:** `app/admin/users/page.tsx` — `handleDelete`, `handleRoleChange`  
If the API call fails, `reload()` still fires and the UI silently shows the old state. The user has no indication the operation failed.

---

## Patterns to Follow Going Forward

- **Always add `.limit()`** to Supabase queries. Never select unbounded tables.
- **Validate all API inputs** at the route level (not just in the UI).
- **Auth-check every `/api/admin/*` route** before touching the admin client.
- **No service-role key in client components.** Admin client is server/API-route only.
- **Prefer returning saved data** from mutations over refetching from DB.
- **Audit writes go to DB**, not localStorage.
