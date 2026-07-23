-- Organizer commission: 5% of each ticket's base price, taken from the
-- organizer's proceeds -- separate from and in addition to the existing
-- 10% service_fee_percent charged on top of what the buyer pays. Global
-- default lives in platform_config; a per-event override (nullable --
-- null means "use the platform default") covers negotiated rates.
ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS organizer_commission_percent numeric NOT NULL DEFAULT 5;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS commission_percent numeric;

-- Immutable record of what was actually taken on each specific sale --
-- deliberately not just "recompute from the current rate", since rates
-- can change after the fact and the historical record shouldn't drift.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS platform_commission numeric NOT NULL DEFAULT 0;

-- The System Wallet: every ticket sale's split between the buyer-side fee
-- and the organizer commission, one row per ticket. Sums of this table are
-- the platform's actual earnings -- kept separate from the ticket/payment
-- tables' totals (which reflect total money processed, not money kept).
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id),
  event_id uuid REFERENCES public.events(id),
  organizer_id uuid REFERENCES public.profiles(id),
  buyer_fee_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_ledger_created ON public.wallet_ledger USING btree (created_at DESC);
CREATE INDEX idx_wallet_ledger_event ON public.wallet_ledger USING btree (event_id);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Super Admin only, per spec -- not even regular Admin sees this.
CREATE POLICY "Super admin reads wallet ledger" ON public.wallet_ledger FOR SELECT USING (is_super_admin());
-- No public INSERT/UPDATE policy -- rows are only ever written by
-- create_ticket_with_capacity_check() via the service role, which bypasses
-- RLS entirely, same as every other server-side-only write path in this
-- schema.

-- Extends create_ticket_with_capacity_check() (20260717000000) with the
-- commission/wallet side-effects, inside the same transaction as the
-- capacity check and ticket insert -- so a ticket can never exist without
-- its matching wallet entry, or vice versa.
--
-- Adding trailing parameters makes this a distinct overload to Postgres,
-- not a replacement of the original -- CREATE OR REPLACE alone leaves both
-- versions callable, which is exactly the kind of ambiguity that lets a
-- stale code path silently keep skipping the wallet ledger. Drop the old
-- 24-arg signature explicitly first.
DROP FUNCTION IF EXISTS public.create_ticket_with_capacity_check(
  uuid, text, uuid, uuid, text, text, date, text, text, text, text, text,
  text, uuid, text, numeric, numeric, numeric, text,
  public.payment_method_type, text, public.sale_type, text, integer
);

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
  p_commission_amount numeric DEFAULT 0
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
    platform_commission
  ) VALUES (
    p_id, p_payment_reference, p_event_id, p_ticket_type_id, p_ticket_type_name,
    p_event_title, p_event_date, p_event_time, p_venue, p_buyer_name, p_buyer_contact,
    p_buyer_display_name, p_buyer_email, p_buyer_user_id, p_id_number, p_price,
    p_markup, p_total_paid, p_currency, p_payment_method, 'completed', p_qr_code,
    false, false, now(), p_sale_type, p_seat_number,
    p_commission_amount
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
