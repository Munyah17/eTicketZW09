-- Homepage grew a 5th category pair (exhibition + other), so a 7th
-- section-ad slot is needed to keep a banner between every 2 category rows.
INSERT INTO public.banners (type, position, price_per_day, status)
VALUES
  ('section', 7, 10, 'available')
ON CONFLICT (type, position) DO NOTHING;
