-- Optional attendee ID number, collected at purchase for fraud/lost-ticket
-- recovery. Buyer-facing surfaces never display it; only staff validation
-- screens (/validate, /organizer/gate) show it.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS id_number text NOT NULL DEFAULT '';
