-- Lets an organizer optionally attach custom form fields to their event
-- (e.g. "T-shirt size", "Dietary requirements", "Company name") that a buyer
-- fills in at checkout. Modeled after ticket_types for RLS/ownership, but
-- with no quantity/inventory concept — this is just captured data per sale,
-- so responses live as a JSONB blob on tickets rather than needing a join
-- table with its own atomic-decrement logic.
CREATE TABLE public.event_custom_fields (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'select', 'checkbox', 'number')),
  options jsonb, -- array of strings, only meaningful for field_type = 'select'
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_custom_fields_event ON public.event_custom_fields USING btree (event_id);

ALTER TABLE public.event_custom_fields ENABLE ROW LEVEL SECURITY;

-- Same ownership boundary as ticket_types: the organizer who owns the event,
-- or an admin/super admin, can manage its custom fields; anyone can read
-- them (checkout needs to render the fields for a published event with no
-- auth required).
CREATE POLICY "Anyone reads event custom fields" ON public.event_custom_fields
  FOR SELECT USING (true);
CREATE POLICY "Organizer manages own event custom fields" ON public.event_custom_fields
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = event_id AND (events.organizer_id = auth.uid() OR is_admin()))
  );

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS custom_field_responses jsonb NOT NULL DEFAULT '{}';
