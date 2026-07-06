-- Homepage now interleaves a banner after every single section (13 sections:
-- Featured, Best Selling, 10 categories, Coming Soon) instead of pairing two
-- categories per banner, so the section-ad inventory grows from 7 to 13 slots.
INSERT INTO public.banners (type, position, price_per_day, status)
VALUES
  ('section', 8, 10, 'available'),
  ('section', 9, 10, 'available'),
  ('section', 10, 10, 'available'),
  ('section', 11, 10, 'available'),
  ('section', 12, 10, 'available'),
  ('section', 13, 10, 'available')
ON CONFLICT (type, position) DO NOTHING;
