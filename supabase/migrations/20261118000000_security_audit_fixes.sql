-- ============================================================================
-- SECURITY AUDIT FIXES — pre-scale hardening
-- ============================================================================
-- Closes the forgery holes found in the whole-codebase audit:
--   C1  create_ticket_with_capacity_check was callable by anon/authenticated
--       via PostgREST and minted payment_status='completed' tickets with
--       caller-supplied amounts. Now service-role only + in-body guard.
--   C2  payments / tickets / audit_logs had WITH CHECK (true) / USING (true)
--       policies from the baseline that were never re-tightened. All writes
--       for these tables already go through the service-role admin client,
--       so anon/authenticated lose INSERT/UPDATE/DELETE entirely.
--   H3  Multi-ticket orders mint N ticket rows sharing one payment_reference,
--       so no unique index is possible there. Double-issuance is prevented in
--       confirmPaid by deficit-counting + a fulfillment_started_at mutex, and
--       oversell stays backstopped by the capacity-check row lock.
--   H4/H5/H6  events / organizers / ticket_types financial + inventory
--       columns become admin/service-role/system-trigger only, enforced by
--       triggers (organizers keep editing their own listings, but can't
--       self-publish, self-verify, inflate revenue, or zero their commission).
-- ============================================================================

-- ── 0. Privileged-writer helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_system_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT auth.role() = 'service_role'
      OR public.is_admin()
      OR current_setting('app.system_write', true) = 'true';
$function$;

-- ── 1. C1 — ticket-creation RPC: service-role only ──────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_ticket_with_capacity_check(
  uuid, text, uuid, uuid, text, text, date, text, text, text, text, text,
  text, uuid, text, numeric, numeric, numeric, text,
  public.payment_method_type, text, public.sale_type, text, integer,
  numeric, numeric, jsonb, text, uuid, text, integer, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_ticket_with_capacity_check(
  uuid, text, uuid, uuid, text, text, date, text, text, text, text, text,
  text, uuid, text, numeric, numeric, numeric, text,
  public.payment_method_type, text, public.sale_type, text, integer,
  numeric, numeric, jsonb, text, uuid, text, integer, jsonb, jsonb
) TO service_role;

-- Defense in depth: even if EXECUTE is ever re-granted by accident, the
-- function refuses non-service-role callers. Body is identical to
-- 20260919000000 except for the guard at the top.
CREATE OR REPLACE FUNCTION public.create_ticket_with_capacity_check(
  p_id uuid,
  p_payment_reference text,
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_ticket_type_name text,
  p_event_title text,
  p_event_date date,
  p_event_time text,
  p_venue text,
  p_buyer_name text,
  p_buyer_contact text,
  p_buyer_display_name text,
  p_buyer_email text,
  p_buyer_user_id uuid,
  p_id_number text,
  p_price numeric,
  p_markup numeric,
  p_total_paid numeric,
  p_currency text,
  p_payment_method public.payment_method_type,
  p_qr_code text,
  p_sale_type public.sale_type,
  p_seat_number text,
  p_requested_qty integer,
  p_buyer_fee_amount numeric DEFAULT 0,
  p_commission_amount numeric DEFAULT 0,
  p_custom_field_responses jsonb DEFAULT '{}',
  p_ticket_number text DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL,
  p_receiver_name text DEFAULT NULL,
  p_admit_count integer DEFAULT 1,
  p_party_composition jsonb DEFAULT '{}',
  p_attendees jsonb DEFAULT '[]'
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_quantity integer;
  v_sold integer;
  v_organizer_id uuid;
  v_ticket public.tickets;
BEGIN
  -- Only the service role (server-side admin client) may mint tickets.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Ticket creation is restricted to the server.' USING ERRCODE = '42501';
  END IF;

  IF p_requested_qty IS NULL OR p_requested_qty < 1 THEN
    p_requested_qty := 1;
  END IF;

  SELECT quantity, sold INTO v_quantity, v_sold
  FROM public.ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_TYPE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_sold + p_requested_qty > v_quantity THEN
    RAISE EXCEPTION 'SOLD_OUT: % of % already sold, % requested', v_sold, v_quantity, p_requested_qty
      USING ERRCODE = 'P0001';
  END IF;

  SELECT organizer_id INTO v_organizer_id FROM public.events WHERE id = p_event_id;

  INSERT INTO public.tickets (
    id, payment_reference, event_id, ticket_type_id, ticket_type_name,
    event_title, event_date, event_time, venue, buyer_name, buyer_contact,
    buyer_display_name, buyer_email, buyer_user_id, id_number, price,
    markup, total_paid, currency, payment_method, payment_status, qr_code,
    validated, is_admitted, purchased_at, sale_type, seat_number,
    platform_commission, custom_field_responses,
    ticket_number, batch_id, receiver_name, admit_count, party_composition, attendees
  ) VALUES (
    p_id, p_payment_reference, p_event_id, p_ticket_type_id, p_ticket_type_name,
    p_event_title, p_event_date, p_event_time, p_venue, p_buyer_name, p_buyer_contact,
    p_buyer_display_name, p_buyer_email, p_buyer_user_id, p_id_number, p_price,
    p_markup, p_total_paid, p_currency, p_payment_method, 'completed', p_qr_code,
    false, false, now(), p_sale_type, p_seat_number,
    p_commission_amount, COALESCE(p_custom_field_responses, '{}'::jsonb),
    p_ticket_number, p_batch_id, p_receiver_name,
    GREATEST(1, COALESCE(p_admit_count, 1)),
    COALESCE(p_party_composition, '{}'::jsonb),
    COALESCE(p_attendees, '[]'::jsonb)
  )
  RETURNING * INTO v_ticket;

  INSERT INTO public.wallet_ledger (
    ticket_id, event_id, organizer_id, buyer_fee_amount, commission_amount, currency
  ) VALUES (
    v_ticket.id, p_event_id, v_organizer_id, p_buyer_fee_amount, p_commission_amount, p_currency
  );

  RETURN v_ticket;
END;
$function$;

-- ── 2. C2 — payments / tickets / audit_logs: service-role writes only ───────
-- Drop the baseline's permissive policies, then revoke the table privileges
-- so a future permissive policy can't be exploited without re-granting.
-- SELECT policies are untouched (buyers/organizers/admins still read their
-- own rows through the API's admin client, which bypasses RLS anyway).
DROP POLICY IF EXISTS "Service inserts payments" ON public.payments;
DROP POLICY IF EXISTS "Service updates payments" ON public.payments;
DROP POLICY IF EXISTS "Service inserts tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admin or organizer updates" ON public.tickets;
DROP POLICY IF EXISTS "System inserts audit logs" ON public.audit_logs;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tickets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- ── 3. H3 — multi-ticket idempotency (NO unique index on payment_reference) ──
-- A multi-ticket order mints N ticket rows that ALL share the payment's
-- reference (that is how the batch barcode groups them at the gate), so a
-- plain UNIQUE(payment_reference) would reject the 2nd ticket. Double-
-- issuance is instead prevented in confirmPaid by (a) counting existing
-- tickets and issuing only the deficit, and (b) the fulfillment_started_at
-- mutex in section 8. The capacity lock inside
-- create_ticket_with_capacity_check remains the oversell backstop.
-- ── 4. H4/H5/H6 — financial + inventory column protection ──────────────────
-- Organizers keep full CRUD on their own listings, but admin/platform-owned
-- columns are restored to their old values on UPDATE and forced to safe
-- defaults on INSERT unless the writer is privileged.

-- events: status transitions, commission, markup, negotiated terms, and the
-- derived sold/total counters are not organizer-writable.
CREATE OR REPLACE FUNCTION public.enforce_event_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auto_approve boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_system_or_admin() THEN
      -- Status is decided by the platform's auto-approve setting, never by
      -- the client. Default to pending_review when the flag is off/absent.
      SELECT auto_approve_events INTO v_auto_approve
      FROM public.platform_config WHERE id = 1;
      IF v_auto_approve IS NOT TRUE THEN
        NEW.status := 'pending_review'::public.event_status;
      END IF;
      -- Platform-owned financial columns start empty for non-privileged writers.
      NEW.commission_percent := NULL;
      NEW.platform_markup := 0;
      NEW.platform_negotiated := NULL;
      NEW.sold_tickets := 0;
      NEW.total_tickets := 0;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT public.is_system_or_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;
    IF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent THEN
      NEW.commission_percent := OLD.commission_percent;
    END IF;
    IF NEW.platform_markup IS DISTINCT FROM OLD.platform_markup THEN
      NEW.platform_markup := OLD.platform_markup;
    END IF;
    IF NEW.platform_negotiated IS DISTINCT FROM OLD.platform_negotiated THEN
      NEW.platform_negotiated := OLD.platform_negotiated;
    END IF;
    IF NEW.sold_tickets IS DISTINCT FROM OLD.sold_tickets THEN
      NEW.sold_tickets := OLD.sold_tickets;
    END IF;
    IF NEW.total_tickets IS DISTINCT FROM OLD.total_tickets THEN
      NEW.total_tickets := OLD.total_tickets;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS events_integrity_guard ON public.events;
CREATE TRIGGER events_integrity_guard
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_integrity();

-- organizers: verified / revenue / payout balances are admin- or
-- system-managed; an organizer editing their own profile can't self-verify
-- or inflate the numbers the payout queue is reviewed against.
CREATE OR REPLACE FUNCTION public.enforce_organizer_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT public.is_system_or_admin() THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified THEN
      NEW.verified := OLD.verified;
    END IF;
    IF NEW.total_revenue IS DISTINCT FROM OLD.total_revenue THEN
      NEW.total_revenue := OLD.total_revenue;
    END IF;
    IF NEW.pending_payout IS DISTINCT FROM OLD.pending_payout THEN
      NEW.pending_payout := OLD.pending_payout;
    END IF;
    IF NEW.total_events IS DISTINCT FROM OLD.total_events THEN
      NEW.total_events := OLD.total_events;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS organizers_integrity_guard ON public.organizers;
CREATE TRIGGER organizers_integrity_guard
  BEFORE UPDATE ON public.organizers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organizer_integrity();

-- ticket_types: `sold` is owned by the update_sold_counts trigger; quantity
-- can never drop below what's already sold (prevents oversell via edit).
CREATE OR REPLACE FUNCTION public.enforce_ticket_type_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- sold is owned by the update_sold_counts trigger — a new ticket type
    -- always starts at 0 unless a privileged/system writer says otherwise.
    IF NEW.sold IS DISTINCT FROM 0 AND NOT public.is_system_or_admin() THEN
      NEW.sold := 0;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.sold IS DISTINCT FROM OLD.sold AND NOT public.is_system_or_admin() THEN
      NEW.sold := OLD.sold;
    END IF;
    IF NEW.quantity < NEW.sold THEN
      RAISE EXCEPTION 'quantity (%) cannot be less than tickets already sold (%)', NEW.quantity, NEW.sold
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ticket_types_integrity_guard ON public.ticket_types;
CREATE TRIGGER ticket_types_integrity_guard
  BEFORE INSERT OR UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_type_integrity();

-- ── 5. Let the system triggers write protected columns ──────────────────────
-- sync_event_total_tickets / update_sold_counts legitimately update
-- events.total_tickets / sold_tickets and ticket_types.sold. They now set the
-- transaction-local flag so the guards above let those writes through.
CREATE OR REPLACE FUNCTION public.sync_event_total_tickets()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('app.system_write', 'true', true);
  UPDATE events
  SET total_tickets = (SELECT COALESCE(SUM(quantity), 0) FROM ticket_types WHERE event_id = COALESCE(NEW.event_id, OLD.event_id))
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sold_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('app.system_write', 'true', true);
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'completed') OR
     (TG_OP = 'UPDATE' AND OLD.payment_status <> 'completed' AND NEW.payment_status = 'completed') THEN
    UPDATE ticket_types SET sold = sold + 1 WHERE id = NEW.ticket_type_id;
    UPDATE events SET sold_tickets = sold_tickets + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'completed' AND NEW.payment_status = 'refunded' THEN
    UPDATE ticket_types SET sold = GREATEST(sold - 1, 0) WHERE id = NEW.ticket_type_id;
    UPDATE events SET sold_tickets = GREATEST(sold_tickets - 1, 0) WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 6. wallet_ledger: belt-and-suspenders privilege revoke ─────────────────
-- Already has no write policies (service-role only via RLS), but revoke the
-- table privileges too so a future permissive policy can't expose it.
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger FROM anon, authenticated;

-- ── 7. payout_requests: cap is enforced in app code; keep RLS as-is ────────
-- (Organizer manages own payouts FOR ALL stays — the request route now
-- validates the amount against computed earnings before insert.)

-- ── 8. payments.fulfillment_started_at — fulfillment mutex ─────────────────
-- confirmPaid stamps this before issuing tickets and only proceeds when the
-- stamp is absent or stale (>5 min). Prevents two concurrent confirmPaid calls
-- (webhook + status poll) from double-issuing a multi-ticket order. Nullable,
-- no default — existing rows simply have no lock.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS fulfillment_started_at timestamptz;
