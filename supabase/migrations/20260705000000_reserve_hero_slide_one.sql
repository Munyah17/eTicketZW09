-- Hero slide #1 is always the platform's own promotional slide (rendered
-- client-side, not DB-backed), so it's no longer part of the purchasable
-- ad inventory. Free up positions 6-10 so there are 9 purchasable hero
-- slots (2-10) instead of 4.
DELETE FROM public.banners WHERE type = 'hero' AND position = 1 AND status = 'available' AND image IS NULL;

INSERT INTO public.banners (type, position, price_per_day, status)
VALUES
  ('hero', 6, 20, 'available'),
  ('hero', 7, 20, 'available'),
  ('hero', 8, 20, 'available'),
  ('hero', 9, 20, 'available'),
  ('hero', 10, 20, 'available')
ON CONFLICT (type, position) DO NOTHING;
