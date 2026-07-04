-- ============================================================================
-- BASELINE SCHEMA MIGRATION
-- ============================================================================
-- Reconstructed from the live production database on 2026-07-04. Everything
-- in this file predates migration tracking — it was originally built directly
-- against the Supabase project (dashboard/SQL editor), not through versioned
-- migrations, so none of it existed in git until now.
--
-- This file is NOT idempotent against the live project (the objects already
-- exist there) — it is a from-scratch reproduction so a new environment
-- (disaster recovery, staging, local dev) can be built to match production.
-- Do not "apply" this against the existing production database.
-- ============================================================================

-- ── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── ENUM TYPES ──────────────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'organizer', 'staff', 'customer');
CREATE TYPE public.organizer_category AS ENUM ('music_entertainment', 'event_lifestyle', 'education_professional', 'digital_creator');
CREATE TYPE public.event_category AS ENUM ('comedy', 'music', 'sports', 'marathon', 'conference', 'workshop', 'festival', 'theater', 'exhibition', 'other');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE public.payment_method_type AS ENUM ('ecocash', 'innbucks', 'visa', 'mastercard', 'cash', 'stripe', 'paynow', 'epay');
CREATE TYPE public.payment_status_type AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.sale_type AS ENUM ('online', 'gate');
CREATE TYPE public.staff_role AS ENUM ('gate_manager', 'ticket_seller');
CREATE TYPE public.payout_status_type AS ENUM ('pending', 'processing', 'approved', 'declined');
CREATE TYPE public.banner_type AS ENUM ('hero', 'section');
CREATE TYPE public.banner_status AS ENUM ('active', 'available', 'pending', 'expired');

-- ── TABLES ──────────────────────────────────────────────────────────────────

-- profiles: one row per auth.users row (created by the handle_new_user trigger).
-- organizer_id references organizers(id), created further below — the FK is
-- added after the organizers table exists to break the circular reference.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'customer',
  organizer_id uuid,
  organizer_category public.organizer_category,
  organizer_subtype text,
  avatar text,
  verified boolean NOT NULL DEFAULT false,
  is_suspended boolean NOT NULL DEFAULT false,
  username text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organizers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  company text,
  organizer_category public.organizer_category,
  organizer_subtype text,
  verified boolean NOT NULL DEFAULT false,
  total_events integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  pending_payout numeric NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_organizer FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE SET NULL;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category public.event_category NOT NULL,
  date date NOT NULL,
  time text NOT NULL DEFAULT '',
  end_date date,
  end_time text,
  venue text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  gallery text[] DEFAULT '{}',
  organizer_id uuid NOT NULL REFERENCES public.profiles(id),
  organizer_name text NOT NULL DEFAULT '',
  organizer_category public.organizer_category,
  organizer_subtype text,
  total_tickets integer NOT NULL DEFAULT 0,
  sold_tickets integer NOT NULL DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'draft',
  platform_markup numeric DEFAULT 0,
  promo_video jsonb,
  platform_negotiated jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  quantity integer NOT NULL DEFAULT 0,
  sold integer NOT NULL DEFAULT 0,
  markup numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  reference text NOT NULL UNIQUE,
  provider text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  user_id uuid REFERENCES public.profiles(id),
  event_id uuid REFERENCES public.events(id),
  ticket_type_id uuid REFERENCES public.ticket_types(id),
  stripe_session_id text,
  paynow_poll_url text,
  metadata jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
  ticket_type_name text NOT NULL,
  event_title text NOT NULL,
  event_date date NOT NULL,
  event_time text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  buyer_name text NOT NULL,
  buyer_contact text NOT NULL DEFAULT '',
  buyer_display_name text NOT NULL DEFAULT '',
  buyer_user_id uuid REFERENCES public.profiles(id),
  buyer_email text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  markup numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_method public.payment_method_type,
  payment_reference text REFERENCES public.payments(reference),
  payment_status public.payment_status_type NOT NULL DEFAULT 'pending',
  qr_code text NOT NULL DEFAULT '',
  validated boolean NOT NULL DEFAULT false,
  validated_at timestamptz,
  validated_by uuid REFERENCES public.profiles(id),
  admitted_at timestamptz,
  admitted_by uuid REFERENCES public.profiles(id),
  is_admitted boolean NOT NULL DEFAULT false,
  sale_type public.sale_type NOT NULL DEFAULT 'online',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id),
  user_id uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  role public.staff_role NOT NULL DEFAULT 'ticket_seller',
  assigned_events uuid[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id),
  organizer_name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status public.payout_status_type NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL,
  payment_details text NOT NULL DEFAULT '',
  transaction_cost numeric NOT NULL DEFAULT 0,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(id),
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  type public.banner_type NOT NULL DEFAULT 'section',
  position integer NOT NULL DEFAULT 0,
  image text,
  link text,
  title text,
  organizer_id uuid REFERENCES public.organizers(id),
  start_date date,
  end_date date,
  price_per_day numeric NOT NULL DEFAULT 10,
  status public.banner_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gate_sales (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
  quantity integer NOT NULL DEFAULT 1,
  buyer_name text NOT NULL,
  buyer_contact text,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  sold_by uuid NOT NULL REFERENCES public.profiles(id),
  ticket_ids uuid[] DEFAULT '{}',
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  actor_id uuid REFERENCES public.profiles(id),
  actor_email text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_audit_actor ON public.audit_logs USING btree (actor_id);
CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_banners_position ON public.banners USING btree ("position");
CREATE INDEX idx_banners_status ON public.banners USING btree (status);
CREATE INDEX idx_events_category ON public.events USING btree (category);
CREATE INDEX idx_events_created_at ON public.events USING btree (created_at DESC);
CREATE INDEX idx_events_date ON public.events USING btree (date);
CREATE INDEX idx_events_organizer ON public.events USING btree (organizer_id);
CREATE INDEX idx_events_sold ON public.events USING btree (sold_tickets DESC);
CREATE INDEX idx_events_status ON public.events USING btree (status);
CREATE INDEX idx_payments_event ON public.payments USING btree (event_id);
CREATE INDEX idx_payments_ref ON public.payments USING btree (reference);
CREATE INDEX idx_payments_status ON public.payments USING btree (status);
CREATE INDEX idx_payments_user ON public.payments USING btree (user_id);
CREATE INDEX idx_payout_organizer ON public.payout_requests USING btree (organizer_id);
CREATE INDEX idx_payout_status ON public.payout_requests USING btree (status);
CREATE INDEX idx_staff_organizer ON public.staff_members USING btree (organizer_id);
CREATE INDEX idx_tt_event ON public.ticket_types USING btree (event_id);
CREATE INDEX idx_tickets_buyer ON public.tickets USING btree (buyer_user_id);
CREATE INDEX idx_tickets_event ON public.tickets USING btree (event_id);
CREATE INDEX idx_tickets_qr ON public.tickets USING btree (qr_code);
CREATE INDEX idx_tickets_ref ON public.tickets USING btree (payment_reference);
CREATE INDEX idx_tickets_status ON public.tickets USING btree (payment_status);

-- ── FUNCTIONS ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'),
    COALESCE((NEW.raw_user_meta_data->>'verified')::boolean, FALSE)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'));
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'organizer');
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_event_total_tickets()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE events
  SET total_tickets = (SELECT COALESCE(SUM(quantity), 0) FROM ticket_types WHERE event_id = COALESCE(NEW.event_id, OLD.event_id))
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sold_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'completed') OR
     (TG_OP = 'UPDATE' AND OLD.payment_status <> 'completed' AND NEW.payment_status = 'completed') THEN
    UPDATE ticket_types SET sold = sold + 1 WHERE id = NEW.ticket_type_id;
    UPDATE events SET sold_tickets = sold_tickets + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'completed' AND NEW.payment_status = 'refunded' THEN
    UPDATE ticket_types SET sold = GREATEST(sold - 1, 0) WHERE id = NEW.ticket_type_id;
    UPDATE events SET sold_tickets = GREATEST(sold_tickets - 1, 0) WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Super Admin accounts can never be deleted (including via ON DELETE CASCADE
-- from auth.users), and the last remaining Super Admin can never be demoted.
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'Super Admin accounts cannot be deleted. Change the role instead.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      IF (SELECT count(*) FROM public.profiles WHERE role = 'super_admin' AND id <> OLD.id) = 0 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining Super Admin.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── TRIGGERS ────────────────────────────────────────────────────────────────
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER organizers_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ticket_types_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER payout_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tt_sync_total AFTER INSERT OR UPDATE OR DELETE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.sync_event_total_tickets();
CREATE TRIGGER tickets_sold_counts AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_sold_counts();

CREATE TRIGGER protect_super_admin_delete BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();
CREATE TRIGGER protect_super_admin_demote BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Public can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Trigger can insert profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "User updates own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin updates any profile" ON public.profiles FOR UPDATE USING (is_admin());

-- organizers
CREATE POLICY "Public can read organizers" ON public.organizers FOR SELECT USING (true);
CREATE POLICY "User inserts own organizer" ON public.organizers FOR INSERT WITH CHECK ((user_id = auth.uid()) OR is_admin());
CREATE POLICY "User updates own organizer" ON public.organizers FOR UPDATE USING ((user_id = auth.uid()) OR is_admin());
CREATE POLICY "Admin deletes organizer" ON public.organizers FOR DELETE USING (is_admin());

-- events
CREATE POLICY "Anyone reads published events" ON public.events FOR SELECT USING ((status = 'published'::event_status) OR (organizer_id = auth.uid()) OR is_admin());
CREATE POLICY "Organizer creates event" ON public.events FOR INSERT WITH CHECK ((organizer_id = auth.uid()) OR is_admin());
CREATE POLICY "Organizer updates own event" ON public.events FOR UPDATE USING ((organizer_id = auth.uid()) OR is_admin());
CREATE POLICY "Admin deletes event" ON public.events FOR DELETE USING (is_admin());

-- ticket_types
CREATE POLICY "Anyone reads published tt" ON public.ticket_types FOR SELECT USING (
  (EXISTS (SELECT 1 FROM events WHERE events.id = ticket_types.event_id AND (events.status = 'published'::event_status OR events.organizer_id = auth.uid()))) OR is_admin()
);
CREATE POLICY "Organizer manages own tt" ON public.ticket_types FOR ALL USING (
  (EXISTS (SELECT 1 FROM events WHERE events.id = ticket_types.event_id AND events.organizer_id = auth.uid())) OR is_admin()
);

-- payments
CREATE POLICY "User reads own payments" ON public.payments FOR SELECT USING ((user_id = auth.uid()) OR is_admin());
CREATE POLICY "Service inserts payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service updates payments" ON public.payments FOR UPDATE USING (true);

-- tickets
CREATE POLICY "User reads own tickets" ON public.tickets FOR SELECT USING ((buyer_user_id = auth.uid()) OR is_admin());
CREATE POLICY "Organizer reads event tickets" ON public.tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM events WHERE events.id = tickets.event_id AND events.organizer_id = auth.uid())
);
CREATE POLICY "Service inserts tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin or organizer updates" ON public.tickets FOR UPDATE USING (
  is_admin() OR (EXISTS (SELECT 1 FROM events WHERE events.id = tickets.event_id AND events.organizer_id = auth.uid()))
);

-- staff_members
CREATE POLICY "Staff reads own record" ON public.staff_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Organizer manages own staff" ON public.staff_members FOR ALL USING (
  (EXISTS (SELECT 1 FROM organizers WHERE organizers.id = staff_members.organizer_id AND organizers.user_id = auth.uid())) OR is_admin()
);

-- payout_requests
CREATE POLICY "Organizer manages own payouts" ON public.payout_requests FOR ALL USING (
  (EXISTS (SELECT 1 FROM organizers WHERE organizers.id = payout_requests.organizer_id AND organizers.user_id = auth.uid())) OR is_admin()
);

-- banners
CREATE POLICY "Anyone reads active banners" ON public.banners FOR SELECT USING ((status = 'active'::banner_status) OR is_admin());
CREATE POLICY "Admin manages banners" ON public.banners FOR ALL USING (is_admin());

-- gate_sales
CREATE POLICY "Organizer and staff gate sales" ON public.gate_sales FOR ALL USING (
  (sold_by = auth.uid()) OR
  (EXISTS (SELECT 1 FROM events WHERE events.id = gate_sales.event_id AND events.organizer_id = auth.uid())) OR
  is_admin()
);

-- audit_logs
CREATE POLICY "Admin reads audit logs" ON public.audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "System inserts audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
