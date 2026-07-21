-- Service Provider Passes — printable ID-style credentials for event-day
-- personnel (ushers, security, DJs, sound engineers, etc.) who need to be
-- identifiable on-site but never need a login. Deliberately a separate
-- concept from staff_members (which is for platform accounts that operate
-- the gate scanner) — a service provider pass holder never signs in.
CREATE TABLE public.service_provider_passes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  issued_by uuid NOT NULL REFERENCES public.profiles(id),
  full_name text NOT NULL,
  photo_url text NOT NULL DEFAULT '',
  company_name text NOT NULL,
  position text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sp_passes_event ON public.service_provider_passes USING btree (event_id);

CREATE TRIGGER sp_passes_updated_at BEFORE UPDATE ON public.service_provider_passes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.service_provider_passes ENABLE ROW LEVEL SECURITY;

-- Reads: the owning organizer, Super Admin, or via the public verification
-- endpoint (service role, bypasses RLS — the API route itself is what
-- limits which fields a public QR scan actually returns).
CREATE POLICY "Organizer reads own event passes" ON public.service_provider_passes FOR SELECT USING (
  (EXISTS (SELECT 1 FROM events WHERE events.id = service_provider_passes.event_id AND events.organizer_id = auth.uid()))
  OR is_super_admin()
);

-- Writes: same boundary as reads. Regular Admin (non-super) is deliberately
-- excluded — this feature is scoped to Super Admin and the owning organizer
-- only, narrower than the usual admin-or-super-admin pairing used elsewhere.
CREATE POLICY "Organizer manages own event passes" ON public.service_provider_passes FOR ALL USING (
  (EXISTS (SELECT 1 FROM events WHERE events.id = service_provider_passes.event_id AND events.organizer_id = auth.uid()))
  OR is_super_admin()
) WITH CHECK (
  (EXISTS (SELECT 1 FROM events WHERE events.id = service_provider_passes.event_id AND events.organizer_id = auth.uid()))
  OR is_super_admin()
);
