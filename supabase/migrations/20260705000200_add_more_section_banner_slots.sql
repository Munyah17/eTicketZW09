-- 5 more category rows were added to the homepage, so the section-ad
-- inventory grows from 3 to 6 slots to keep a banner between every 2
-- category rows.
INSERT INTO public.banners (type, position, price_per_day, status)
VALUES
  ('section', 4, 10, 'available'),
  ('section', 5, 10, 'available'),
  ('section', 6, 10, 'available')
ON CONFLICT (type, position) DO NOTHING;
