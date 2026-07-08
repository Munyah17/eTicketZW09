-- Create organizer_payout_methods table to allow saving multiple payout methods (max 5 per organizer)
CREATE TABLE public.organizer_payout_methods (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  label text NOT NULL,
  payment_method text NOT NULL,
  payment_details text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT max_five_methods_per_organizer CHECK (
    (SELECT COUNT(*) FROM organizer_payout_methods WHERE organizer_id = organizers.id) <= 5
  )
);

-- Add index for efficient lookups
CREATE INDEX idx_organizer_payout_methods_organizer ON public.organizer_payout_methods USING btree (organizer_id);

-- Add impressions column to banners table for tracking view counts
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0;

-- Create index for banner impressions tracking
CREATE INDEX IF NOT EXISTS idx_banners_impressions ON public.banners USING btree (impressions DESC);
