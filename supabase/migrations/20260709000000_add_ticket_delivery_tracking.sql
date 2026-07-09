-- Ticket issuance proof-of-delivery tracking.
-- A ticket is only "issued" once it has actually been pushed to the buyer
-- (email and/or WhatsApp). Generation alone is not issuance.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_log jsonb NOT NULL DEFAULT '[]';

-- Tickets that predate delivery tracking were delivered under the old flow;
-- backfill so they don't surface as "generated but never issued" alerts.
UPDATE public.tickets SET issued_at = created_at WHERE issued_at IS NULL;

-- Health dashboards query for "generated but never issued" tickets.
CREATE INDEX IF NOT EXISTS idx_tickets_issued_at ON public.tickets (issued_at);
