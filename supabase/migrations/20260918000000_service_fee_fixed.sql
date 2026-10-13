-- Buyer-side service fee gains a fixed-amount component alongside the
-- existing percentage: fee = subtotal * service_fee_percent/100 + service_fee_fixed.
-- Either can be 0 (percentage-only, fixed-only, both, or neither). The
-- structure stays a trade secret — buyers only ever see the computed
-- "Processing Fee" dollar total.
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS service_fee_fixed numeric NOT NULL DEFAULT 0;
