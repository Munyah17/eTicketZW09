-- Tracks the moment an event first sells out, so the homepage "Best Selling"
-- row can keep a sold-out event visible (with a Sold Out ribbon) for a
-- week after it sells out instead of dropping it immediately.
ALTER TABLE public.events ADD COLUMN sold_out_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_sold_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'completed') OR
     (TG_OP = 'UPDATE' AND OLD.payment_status <> 'completed' AND NEW.payment_status = 'completed') THEN
    UPDATE ticket_types SET sold = sold + 1 WHERE id = NEW.ticket_type_id;
    UPDATE events
    SET sold_tickets = sold_tickets + 1,
        sold_out_at = CASE
          WHEN total_tickets > 0 AND sold_tickets + 1 >= total_tickets AND sold_out_at IS NULL THEN now()
          ELSE sold_out_at
        END
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'completed' AND NEW.payment_status = 'refunded' THEN
    UPDATE ticket_types SET sold = GREATEST(sold - 1, 0) WHERE id = NEW.ticket_type_id;
    UPDATE events
    SET sold_tickets = GREATEST(sold_tickets - 1, 0),
        sold_out_at = CASE
          WHEN GREATEST(sold_tickets - 1, 0) < total_tickets THEN NULL
          ELSE sold_out_at
        END
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$function$;
