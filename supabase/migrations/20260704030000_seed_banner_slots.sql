ALTER TABLE public.banners ADD CONSTRAINT banners_type_position_key UNIQUE (type, position);

INSERT INTO public.banners (type, position, price_per_day, status)
VALUES
  ('hero', 1, 20, 'available'),
  ('hero', 2, 20, 'available'),
  ('hero', 3, 20, 'available'),
  ('hero', 4, 20, 'available'),
  ('hero', 5, 20, 'available'),
  ('section', 1, 10, 'available'),
  ('section', 2, 10, 'available'),
  ('section', 3, 10, 'available')
ON CONFLICT (type, position) DO NOTHING;
