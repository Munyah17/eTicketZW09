-- Fixes a real overselling bug: ticket generation previously inserted a row
-- into `tickets` with no check against ticket_types.quantity at all. Two
-- buyers completing payment for the last spot within the same window would
-- both get a valid ticket, since `sold` was only ever incremented *after*
-- insert (by the existing tickets_sold_counts trigger) with nothing gating
-- the insert itself.
--
-- create_ticket_with_capacity_check() closes that race by locking the
-- ticket_type row (SELECT ... FOR UPDATE) before checking availability and
-- inserting the ticket, all inside one transaction. A concurrent call for
-- the same ticket_type blocks on the lock until the first commits, then
-- re-reads the now-updated `sold` value — so the second call correctly sees
-- reduced availability instead of the stale number it started with. The
-- existing tickets_sold_counts trigger still does the actual `sold`
-- increment on insert, unchanged — this function only adds the missing gate
-- in front of it.
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
  p_requested_qty integer
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_quantity integer;
  v_sold integer;
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

  INSERT INTO public.tickets (
    id, payment_reference, event_id, ticket_type_id, ticket_type_name,
    event_title, event_date, event_time, venue, buyer_name, buyer_contact,
    buyer_display_name, buyer_email, buyer_user_id, id_number, price,
    markup, total_paid, currency, payment_method, payment_status, qr_code,
    validated, is_admitted, purchased_at, sale_type, seat_number
  ) VALUES (
    p_id, p_payment_reference, p_event_id, p_ticket_type_id, p_ticket_type_name,
    p_event_title, p_event_date, p_event_time, p_venue, p_buyer_name, p_buyer_contact,
    p_buyer_display_name, p_buyer_email, p_buyer_user_id, p_id_number, p_price,
    p_markup, p_total_paid, p_currency, p_payment_method, 'completed', p_qr_code,
    false, false, now(), p_sale_type, p_seat_number
  )
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$function$;
