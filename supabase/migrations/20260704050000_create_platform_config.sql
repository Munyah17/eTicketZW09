CREATE TABLE public.platform_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  service_fee_percent numeric NOT NULL DEFAULT 10,
  new_registrations boolean NOT NULL DEFAULT true,
  new_organizer_signups boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  online_payments boolean NOT NULL DEFAULT true,
  stripe_enabled boolean NOT NULL DEFAULT true,
  paynow_enabled boolean NOT NULL DEFAULT true,
  announcement_active boolean NOT NULL DEFAULT false,
  announcement_message text NOT NULL DEFAULT '',
  announcement_type text NOT NULL DEFAULT 'info',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.platform_config (id) VALUES (1);

CREATE TRIGGER platform_config_updated_at BEFORE UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Publicly readable: middleware, checkout, and the announcement banner all
-- need this without requiring auth. Nothing in it is sensitive.
CREATE POLICY "Anyone reads platform config" ON public.platform_config
  FOR SELECT USING (true);
CREATE POLICY "Admin updates platform config" ON public.platform_config
  FOR UPDATE USING (is_admin());

-- Registration gating enforced at the trigger level (not just client-side)
-- so it can't be bypassed by calling the Supabase Auth API directly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg record;
  requested_role user_role;
BEGIN
  SELECT new_registrations, new_organizer_signups INTO cfg FROM public.platform_config WHERE id = 1;
  requested_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');

  IF cfg IS NOT NULL THEN
    IF requested_role = 'organizer' AND NOT cfg.new_organizer_signups THEN
      RAISE EXCEPTION 'Organizer signups are currently disabled.';
    ELSIF requested_role <> 'organizer' AND NOT cfg.new_registrations THEN
      RAISE EXCEPTION 'New registrations are currently disabled.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    requested_role,
    COALESCE((NEW.raw_user_meta_data->>'verified')::boolean, FALSE)
  );
  RETURN NEW;
END;
$function$;
