-- Event commerce features:
--   * optional sold/available ticket-count display per event
--   * per-ticket-class custom charge/markup (admin/super-admin editable)
--   * sellable optional add-ons (merch, books, etc.) on top of a ticket
--   * split payments — deposit up front, balance in later parts
--   * platform-controlled manual/automatic event removal

-- (1) Optional ticket-count display -----------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_ticket_counts boolean NOT NULL DEFAULT false;

-- (2) Per-ticket-class custom charge/markup ----------------------------------
-- Admin/Super Admin can attach an extra per-ticket charge and/or markup to a
-- specific ticket class (General, VIP, VVIP…). Each is either a fixed USD
-- amount or a percentage of the class price; both default to 0 (no change).
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS custom_charge_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_charge_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_markup_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_markup_percent numeric NOT NULL DEFAULT 0;

-- (3) Sellable add-ons -------------------------------------------------------
-- Optional extras a buyer can add to their ticket (t-shirt, book, cap…).
-- quantity NULL = unlimited stock; sold is trigger-free but only written by
-- the server at fulfilment time.
CREATE TABLE IF NOT EXISTS public.event_add_ons (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  quantity integer,
  sold integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_add_ons_event ON public.event_add_ons USING btree (event_id);

ALTER TABLE public.event_add_ons ENABLE ROW LEVEL SECURITY;

-- Anyone can read add-ons (checkout renders them for a published event with
-- no auth). Organizer who owns the event, or an admin/super admin, manages them.
CREATE POLICY "Anyone reads event add-ons" ON public.event_add_ons
  FOR SELECT USING (true);
CREATE POLICY "Organizer manages own event add-ons" ON public.event_add_ons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_id
        AND (events.organizer_id = auth.uid() OR is_admin())
    )
  );

-- (4) Split payments ---------------------------------------------------------
-- Event-level opt-in. deposit_percent is the share due up front; the rest is
-- payable in up to split_installment_count further parts, in any method.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_split_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_deposit_percent numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS split_installment_count integer NOT NULL DEFAULT 2;

-- An order groups the (possibly many) payments that together settle one
-- ticket purchase. Tickets are only issued once amount_paid covers total.
CREATE TABLE IF NOT EXISTS public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  reference text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.events(id),
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
  quantity integer NOT NULL DEFAULT 1,
  buyer_name text NOT NULL DEFAULT '',
  buyer_email text NOT NULL DEFAULT '',
  buyer_phone text NOT NULL DEFAULT '',
  custom_field_responses jsonb NOT NULL DEFAULT '{}',
  add_ons jsonb NOT NULL DEFAULT '[]',
  -- Snapshot of the original checkout metadata (eventTitle, venue, attendees,
  -- admitCount…) so the final installment can mint tickets exactly as the
  -- deposit's metadata described — installment payments carry no buyer form.
  purchase_metadata jsonb NOT NULL DEFAULT '{}',
  subtotal numeric NOT NULL DEFAULT 0,
  fees numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | partially_paid | paid | cancelled
  payment_plan jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON public.ticket_orders USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_buyer ON public.ticket_orders USING btree (buyer_email);

ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

-- Buyers read their own orders; admins/super admins read all. Writes happen
-- only through the service role (API routes), so no INSERT/UPDATE policy for
-- regular users.
CREATE POLICY "Buyers read own orders" ON public.ticket_orders
  FOR SELECT USING (buyer_email = auth.jwt() ->> 'email' OR is_admin());
CREATE POLICY "Admins read all orders" ON public.ticket_orders
  FOR SELECT USING (is_admin());

-- Link a payment to the order it settles (NULL for ordinary one-shot sales).
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.ticket_orders(id);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments USING btree (order_id);

-- (5) Platform-controlled event removal --------------------------------------
-- Default OFF = keep every event listed; removal is manual only. When enabled,
-- a cleanup pass deletes events whose date is more than N days in the past.
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS event_auto_removal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_auto_removal_days integer NOT NULL DEFAULT 30;

-- (6) Admin-only enforcement for per-class custom fees -----------------------
-- ticket_types RLS is FOR ALL for the owning organizer, which would otherwise
-- let an organizer write custom_charge_*/custom_markup_* directly from the
-- browser client. These columns are platform/admin-controlled pricing, so a
-- trigger pins them: non-admin, non-service-role writers keep the existing
-- values on UPDATE and get 0 on INSERT. Admin API calls run as service_role
-- and are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_admin_ticket_custom_fees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.custom_charge_fixed := OLD.custom_charge_fixed;
      NEW.custom_charge_percent := OLD.custom_charge_percent;
      NEW.custom_markup_fixed := OLD.custom_markup_fixed;
      NEW.custom_markup_percent := OLD.custom_markup_percent;
    ELSE
      NEW.custom_charge_fixed := 0;
      NEW.custom_charge_percent := 0;
      NEW.custom_markup_fixed := 0;
      NEW.custom_markup_percent := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_ticket_custom_fees ON public.ticket_types;
CREATE TRIGGER trg_enforce_admin_ticket_custom_fees
  BEFORE INSERT OR UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_ticket_custom_fees();

-- (7) Atomic order-payment recording -----------------------------------------
-- recordOrderPayment used to read the order, compute the new balance in JS and
-- write it back — two concurrent installment confirmations could lose an
-- update. This function takes a row lock (SELECT ... FOR UPDATE) and does the
-- accumulation inside one transaction, so concurrent payments serialise.
CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_reference text
)
RETURNS public.ticket_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.ticket_orders;
  v_plan jsonb;
  v_installments jsonb;
  v_amount_paid numeric;
  v_balance numeric;
  v_status text;
BEGIN
  SELECT * INTO v_order FROM public.ticket_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_order.status IN ('paid', 'cancelled') THEN
    RETURN v_order;
  END IF;

  v_plan := COALESCE(v_order.payment_plan, '{}'::jsonb);
  v_installments := COALESCE(v_plan -> 'installments', '[]'::jsonb);
  IF jsonb_typeof(v_installments) <> 'array' THEN
    v_installments := '[]'::jsonb;
  END IF;

  -- Idempotent per payment reference: confirmPaid can fire more than once for
  -- the same payment (webhook + status poll + admin confirm).
  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_installments) AS e
    WHERE e ->> 'reference' = p_reference
  ) THEN
    RETURN v_order;
  END IF;

  v_amount_paid := COALESCE(v_order.amount_paid, 0) + COALESCE(p_amount, 0);
  v_balance := GREATEST(0, COALESCE(v_order.total, 0) - v_amount_paid);
  v_status := CASE WHEN v_balance <= 0.005 THEN 'paid' ELSE 'partially_paid' END;

  v_installments := v_installments || jsonb_build_object(
    'amount', COALESCE(p_amount, 0),
    'paid', true,
    'paidAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reference', p_reference
  );
  v_plan := jsonb_set(v_plan, '{installments}', v_installments, true);

  UPDATE public.ticket_orders
  SET amount_paid = v_amount_paid,
      balance = v_balance,
      status = v_status,
      payment_plan = v_plan,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- (8) Atomic add-on stock increment ------------------------------------------
-- Fulfilment used to read `sold` then write `sold + qty` — a non-atomic
-- read-modify-write that could lose updates or oversell under concurrency.
-- This increments atomically and refuses to exceed `quantity` (NULL =
-- unlimited). Returns the new sold count, or -1 when the add-on is missing or
-- the increment would oversell.
CREATE OR REPLACE FUNCTION public.increment_addon_sold(p_id uuid, p_qty integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sold integer;
BEGIN
  UPDATE public.event_add_ons
  SET sold = COALESCE(sold, 0) + GREATEST(0, COALESCE(p_qty, 0))
  WHERE id = p_id
    AND (quantity IS NULL OR COALESCE(sold, 0) + GREATEST(0, COALESCE(p_qty, 0)) <= quantity)
  RETURNING sold INTO v_sold;
  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN v_sold;
END;
$$;
