-- Expands Platform Configuration with real, admin-editable controls:
-- general site identity/contact info, event moderation gating, and a
-- configurable minimum payout amount (previously a hardcoded constant).
ALTER TABLE public.platform_config
  ADD COLUMN site_name text NOT NULL DEFAULT 'E-TicketsZW',
  ADD COLUMN support_email text NOT NULL DEFAULT 'support@eticket.co.zw',
  ADD COLUMN support_phone text NOT NULL DEFAULT '+263 773 909 307',
  ADD COLUMN auto_approve_events boolean NOT NULL DEFAULT true,
  ADD COLUMN min_payout_amount numeric NOT NULL DEFAULT 10;
