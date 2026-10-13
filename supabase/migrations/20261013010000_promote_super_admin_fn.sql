-- promote_super_admin(p_user_id): promotion path for an already-established
-- platform. bootstrap_super_admin() refuses once any super_admin exists (it
-- was built for initial seed/disaster recovery); this twin drops the
-- singleton check so a live Super Admin can grant the role to additional
-- accounts through the super-admin API — still only callable as
-- service_role, still the only UPDATE that can mint a super_admin.
CREATE OR REPLACE FUNCTION public.promote_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'promote_super_admin requires the service role.';
  END IF;

  PERFORM set_config('app.bootstrap_super_admin', 'true', true);

  UPDATE public.profiles
  SET role = 'super_admin', is_suspended = false
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for user %.', p_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_super_admin(uuid) TO service_role;
