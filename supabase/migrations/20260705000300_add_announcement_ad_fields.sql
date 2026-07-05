-- Lets the site-wide announcement banner double as a paid ad slot
-- ($50/2 weeks): announcement_type can now also be 'ad', in which case
-- announcement_image/announcement_link are shown instead of a text message.
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS announcement_image text,
  ADD COLUMN IF NOT EXISTS announcement_link text;
