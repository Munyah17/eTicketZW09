-- Purely additive: EcoCash gets the same admin on/off switch as Stripe and
-- Paynow already have, alongside them, without touching either.
ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS ecocash_enabled boolean NOT NULL DEFAULT true;
