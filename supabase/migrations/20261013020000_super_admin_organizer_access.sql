-- Super Admin gets organiser access: every organizer-scoped surface
-- (payouts, staff, gate, advertising) resolves its caller through
-- organizers.user_id, so super_admin accounts need an entity row too.
-- Backfill for existing super admins, and extend promote_super_admin()
-- so future super admins get the row automatically on promotion.

-- 1. Backfill: one verified organizers row per super_admin profile.
INSERT INTO public.organizers (user_id, name, email, phone, verified)
SELECT p.id,
       COALESCE(NULLIF(p.name, ''), split_part(p.email, '@', 1)),
       p.email,
       COALESCE(p.phone, ''),
       TRUE
FROM public.profiles p
WHERE p.role = 'super_admin'
  AND NOT EXISTS (SELECT 1 FROM public.organizers o WHERE o.user_id = p.id);

-- Link profiles to their organizer entity rows.
UPDATE public.profiles p
SET organizer_id = o.id
FROM public.organizers o
WHERE o.user_id = p.id AND p.organizer_id IS DISTINCT FROM o.id;

-- 2. promote_super_admin() now also provisions the organizer entity row,
-- so a promoted account can use organizer surfaces without extra steps.
CREATE OR REPLACE FUNCTION public.promote_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  org_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'promote_super_admin requires the service role.';
  END IF;

  PERFORM set_config('app.bootstrap_super_admin', 'true', true);

  INSERT INTO public.organizers (user_id, name, email, phone, verified)
  SELECT p.id,
         COALESCE(NULLIF(p.name, ''), split_part(p.email, '@', 1)),
         p.email,
         COALESCE(p.phone, ''),
         TRUE
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.organizers o WHERE o.user_id = p.id)
  RETURNING id INTO org_id;

  UPDATE public.profiles
  SET role = 'super_admin',
      is_suspended = false,
      organizer_id = COALESCE(org_id, organizer_id)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for user %.', p_user_id;
  END IF;
END;
$function$;
