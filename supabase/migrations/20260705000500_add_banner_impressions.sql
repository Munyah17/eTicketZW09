-- Impression tracking so organizers/admins can see how many times a paid
-- banner has actually been shown, and the homepage can show a public view
-- count (like Twitter/WordPress view badges).
ALTER TABLE public.banners ADD COLUMN impressions bigint NOT NULL DEFAULT 0;

-- SECURITY DEFINER so anonymous visitors can bump the counter for an active
-- banner without needing UPDATE grants on the table (RLS only allows SELECT
-- for anon). Scoped to active banners only, ignores unknown/inactive ids.
CREATE OR REPLACE FUNCTION public.increment_banner_impression(banner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.banners
  SET impressions = impressions + 1
  WHERE id = banner_id AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.increment_banner_impression(uuid) TO anon, authenticated;
