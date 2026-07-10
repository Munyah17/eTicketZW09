-- Create organizer_payout_methods table to allow saving multiple payout methods.
-- The max-5-per-organizer rule is enforced in the API route (Postgres CHECK
-- constraints cannot contain subqueries, so it can't live here — the original
-- version of this migration had one and could never apply, which silently
-- stalled all schema deployment from this point on).
CREATE TABLE IF NOT EXISTS public.organizer_payout_methods (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  label text NOT NULL,
  payment_method text NOT NULL,
  payment_details text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizer_payout_methods_organizer
  ON public.organizer_payout_methods USING btree (organizer_id);

-- The API accesses this table with the user's session (anon key + RLS),
-- so the table must be locked down and organizers scoped to their own rows.
ALTER TABLE public.organizer_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer manages own payout methods" ON public.organizer_payout_methods
  FOR ALL
  USING (
    organizer_id IN (SELECT id FROM public.organizers WHERE user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    organizer_id IN (SELECT id FROM public.organizers WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Add impressions column to banners table for tracking view counts
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0;

-- Create index for banner impressions tracking
CREATE INDEX IF NOT EXISTS idx_banners_impressions ON public.banners USING btree (impressions DESC);
