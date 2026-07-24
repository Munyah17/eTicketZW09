-- Extends create_ticket_with_capacity_check() (last extended in
-- 20260722000000) to persist the buyer's custom-field responses on the
-- ticket in the same transaction as everything else — same "new overload,
-- not a silent replace" reasoning as that migration: adding a trailing
-- parameter makes this a distinct overload to Postgres, so the old 26-arg
-- signature is dropped explicitly first to avoid two versions being
-- simultaneously callable.
DROP FUNCTION IF EXISTS public.create_ticket_with_capacity_check(
  uuid, text, uuid, uuid, text, text, date, text, text, text, text, text,
  text, uuid, text, numeric, numeric, numeric, text,
  public.payment_method_type, text, public.sale_type, text, integer,
  numeric, numeric
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
  p_custom_field_responses jsonb DEFAULT '{}'
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
    platform_commission, custom_field_responses
  ) VALUES (
    p_id, p_payment_reference, p_event_id, p_ticket_type_id, p_ticket_type_name,
    p_event_title, p_event_date, p_event_time, p_venue, p_buyer_name, p_buyer_contact,
    p_buyer_display_name, p_buyer_email, p_buyer_user_id, p_id_number, p_price,
    p_markup, p_total_paid, p_currency, p_payment_method, 'completed', p_qr_code,
    false, false, now(), p_sale_type, p_seat_number,
    p_commission_amount, COALESCE(p_custom_field_responses, '{}'::jsonb)
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
