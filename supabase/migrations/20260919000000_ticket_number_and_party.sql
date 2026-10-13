-- Ticket identity + group admission upgrade.
--
-- 1. ticket_number — the human-facing code printed on the ticket and typed
--    at the gate. Format ET-DDMMYY-XXXXX (ET prefix, purchase date, 5
--    crypto-random alphanumeric chars) — short enough to read out, random
--    enough that a counterfeit can't guess a valid one. Generated in app
--    code and passed in; the column is unique so a collision just retries.
--
-- 2. batch_id — groups every ticket minted under one payment_reference, so
--    a single "batch barcode" on a group order can pull up each individual
--    ticket for validation at the gate.
--
-- 3. receiver_name — when someone buys on behalf of another person. Optional
--    by design (buyers may stay anonymous); used only for lost-ticket
--    verification at the gate.
--
-- 4. admit_count + party_composition — one ticket can admit a group (family
--    events): how many people total, and the adults/children/seniors split
--    the gate should expect.
--
-- 5. attendees — per-attendee details [{name, idNumber, ageGroup, address}].
--    Required by the checkout flow only when the party includes children
--    under 18 (child-safety / lost-kid reunification), otherwise optional.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS admit_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS party_composition jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attendees jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_ticket_number_key
  ON public.tickets (ticket_number) WHERE ticket_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_batch_id_idx
  ON public.tickets (batch_id) WHERE batch_id IS NOT NULL;

-- Extend the atomic ticket-creation RPC with the new fields. Same "new
-- overload, drop the old signature explicitly" pattern as previous
-- migrations — Postgres treats added params as a distinct function.
DROP FUNCTION IF EXISTS public.create_ticket_with_capacity_check(
  uuid, text, uuid, uuid, text, text, date, text, text, text, text, text,
  text, uuid, text, numeric, numeric, numeric, text,
  public.payment_method_type, text, public.sale_type, text, integer,
  numeric, numeric, jsonb
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
