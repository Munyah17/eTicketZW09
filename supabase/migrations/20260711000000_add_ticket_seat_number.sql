-- Optional assigned seat/section shown on the rendered ticket when present.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS seat_number text;
