-- Fix: every organizer signup failed with "Database error saving new user".
--
-- 20261013000000_organizer_row_on_signup inserted into public.organizers
-- BEFORE public.profiles, but organizers.user_id REFERENCES profiles(id) —
-- the FK check failed, the trigger raised, and GoTrue rolled back the whole
-- signup. The profile row must exist first; the organizer row is created
-- second and linked back.
--
-- The organizer side-effect is also wrapped so that a failure there can
-- never block account creation again — the backfill below (and the
-- Organisers admin page) can repair a missing organizer row later, but a
-- rejected signup loses the customer.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_role public.user_role;
  new_name text;
  new_phone text;
  org_id uuid;
BEGIN
  new_role := CASE WHEN (NEW.raw_user_meta_data->>'role') IN ('customer', 'organizer')
                   THEN (NEW.raw_user_meta_data->>'role')::public.user_role
                   ELSE 'customer'::public.user_role
              END;
  new_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1));
  new_phone := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), '');

  INSERT INTO public.profiles (id, email, name, phone, role, verified)
  VALUES (NEW.id, NEW.email, new_name, new_phone, new_role, FALSE)
  ON CONFLICT (id) DO NOTHING;

  IF new_role = 'organizer'::public.user_role THEN
    BEGIN
      INSERT INTO public.organizers (user_id, name, email, phone, verified)
      VALUES (NEW.id, new_name, NEW.email, new_phone, FALSE)
      RETURNING id INTO org_id;

      UPDATE public.profiles SET organizer_id = org_id WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: organizer row for % not created: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Repair organizer accounts that slipped through without an entity row.
INSERT INTO public.organizers (user_id, name, email, phone, verified)
SELECT p.id,
       COALESCE(NULLIF(p.name, ''), split_part(p.email, '@', 1)),
       p.email,
       COALESCE(p.phone, ''),
       FALSE
FROM public.profiles p
WHERE p.role = 'organizer'
  AND NOT EXISTS (SELECT 1 FROM public.organizers o WHERE o.user_id = p.id);

UPDATE public.profiles p
SET organizer_id = o.id
FROM public.organizers o
WHERE o.user_id = p.id AND p.role = 'organizer' AND p.organizer_id IS DISTINCT FROM o.id;
