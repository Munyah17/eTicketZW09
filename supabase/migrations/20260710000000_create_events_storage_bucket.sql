-- Event featured images were never displaying because the "events" storage
-- bucket referenced by /api/organizer/events/image was never created.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('events', 'events', true, 20971520, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public reads event images" ON storage.objects
  FOR SELECT USING (bucket_id = 'events');
