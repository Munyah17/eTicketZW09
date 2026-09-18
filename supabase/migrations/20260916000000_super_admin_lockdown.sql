-- Super Admin lockdown (2026-09-16): after the account purge, the platform
-- has exactly one owner account — munyah777@gmail.com. This migration makes
-- that account undeletable and un-suspendable at the database layer, and
-- adds two tightly-scoped SECURITY DEFINER functions that are the ONLY way
-- to (a) promote a user to super_admin and (b) delete a super_admin row.
--
-- Both functions require the caller's JWT role to be 'service_role' and are
-- only executable by service_role — the same trust boundary the rest of the
-- schema already relies on (the service key is root). The GUC flags they set
-- are transaction-local, so the escape hatches only exist for the duration
-- of the function call and can never be enabled by a normal UPDATE.

-- ── 1. protect_super_admin(): harden ────────────────────────────────────────
-- Adds: (a) the owner email can NEVER be deleted, even through the emergency
-- path; (b) deleting ANY super_admin now requires the emergency GUC, which
-- only emergency_delete_user() can set; (c) a super_admin can never be
-- suspended — suspension is a lockout vector against the owner account.
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      IF OLD.email = 'munyah777@gmail.com' THEN
        RAISE EXCEPTION 'The owner Super Admin account can never be deleted.';
      END IF;
      IF current_setting('app.emergency_user_delete', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Super Admin accounts cannot be deleted. Change the role instead.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      IF (SELECT count(*) FROM public.profiles WHERE role = 'super_admin' AND id <> OLD.id) = 0 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining Super Admin.';
      END IF;
    END IF;

    IF OLD.role = 'super_admin' AND NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
       AND NEW.is_suspended THEN
      RAISE EXCEPTION 'Super Admin accounts cannot be suspended.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2. prevent_role_escalation(): allow promotion ONLY via bootstrap fn ─────
-- Same rule as before (no role change except from the service-role client,
-- never to super_admin) with one addition: bootstrap_super_admin() sets a
-- transaction-local GUC that permits the promotion it performs. Everything
-- else — including a direct UPDATE from the service-role client — is still
-- rejected, so a leaked service key alone cannot mint a super_admin.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Role changes must go through the admin API.';
    END IF;

    IF NEW.role = 'super_admin'
       AND current_setting('app.bootstrap_super_admin', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Promotion to super_admin is not permitted via UPDATE.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 3. bootstrap_super_admin(p_user_id): the only promotion path ────────────
-- Promotes exactly one user to super_admin, and only while no super_admin
-- exists (initial seed / disaster recovery). Once the owner account exists,
-- this function refuses — there is exactly one Super Admin, ever.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'bootstrap_super_admin requires the service role.';
  END IF;

  IF (SELECT count(*) FROM public.profiles WHERE role = 'super_admin') > 0 THEN
    RAISE EXCEPTION 'A Super Admin already exists. Promotion refused.';
  END IF;

  PERFORM set_config('app.bootstrap_super_admin', 'true', true);

  UPDATE public.profiles
  SET role = 'super_admin', is_suspended = false, verified = true
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for user %.', p_user_id;
  END IF;
END;
$function$;

-- ── 4. emergency_delete_user(p_user_id): the only super_admin delete path ───
-- Needed for the one-time account purge (and any future incident response):
-- deleting a super_admin's auth.users row cascades to profiles, where
-- protect_super_admin() would normally raise. This function sets the
-- transaction-local GUC that permits it — and still refuses to delete the
-- owner email, which is checked inside the trigger itself.
CREATE OR REPLACE FUNCTION public.emergency_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'emergency_delete_user requires the service role.';
  END IF;

  PERFORM set_config('app.emergency_user_delete', 'true', true);

  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No auth user found with id %.', p_user_id;
  END IF;
END;
$function$;

-- Only the service role may call either function. Revoke from the default
-- API roles explicitly so a future GRANT-to-public default can't expose them.
REVOKE ALL ON FUNCTION public.bootstrap_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.emergency_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.emergency_delete_user(uuid) TO service_role;
