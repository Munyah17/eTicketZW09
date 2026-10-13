-- Auto-create the organizers business-entity row on organizer signup and
-- backfill rows for organizer accounts that predate this fix.
--
-- The Organisers admin page reads public.organizers, but nothing in the
-- codebase ever inserted there — organizer accounts silently existed only
-- as profiles rows, so they showed under Users but never under Organisers.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_role public.user_role;
  org_id uuid;
BEGIN
  new_role := CASE WHEN (NEW.raw_user_meta_data->>'role') IN ('customer', 'organizer')
                   THEN (NEW.raw_user_meta_data->>'role')::user_role
                   ELSE 'customer'::user_role
              END;

  IF new_role = 'organizer'::user_role THEN
    INSERT INTO public.organizers (user_id, name, email, phone, verified)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      FALSE
    )
    RETURNING id INTO org_id;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, verified, organizer_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    new_role,
    COALESCE((NEW.raw_user_meta_data->>'verified')::boolean, FALSE),
    org_id
  );
  RETURN NEW;
END;
$function$;

-- Backfill organizer entity rows for existing organizer accounts.
INSERT INTO public.organizers (user_id, name, email, phone, verified)
SELECT p.id,
       COALESCE(NULLIF(p.name, ''), split_part(p.email, '@', 1)),
       p.email,
       COALESCE(p.phone, ''),
       FALSE
FROM public.profiles p
WHERE p.role = 'organizer'
  AND NOT EXISTS (SELECT 1 FROM public.organizers o WHERE o.user_id = p.id);

-- Link profiles back to their organizer entity row.
UPDATE public.profiles p
SET organizer_id = o.id
FROM public.organizers o
WHERE o.user_id = p.id AND p.organizer_id IS DISTINCT FROM o.id;
