-- Security incident response (2026-08-13): close the privilege-escalation
-- holes that most likely let the compromised Super Admin account get its
-- role in the first place, without ever needing the real password.
--
-- 1. handle_new_user() trusted a client-supplied `role` in signup metadata
--    with no allowlist — a raw call to Supabase's public signup endpoint
--    with role: "super_admin" created a real super_admin account.
-- 2. profiles UPDATE policies never re-checked the *new* role value, only
--    who was making the request — any authenticated user could self-promote,
--    and any admin could promote anyone (including themselves) to
--    super_admin directly via the DB, bypassing the app entirely.
-- 3. profiles was fully publicly readable, making account enumeration trivial.

-- 1. Lock signup role assignment to customer/organizer only. Every
-- privileged-account creation path (app/api/admin/staff, app/api/admin/users)
-- uses the service-role client and sets role explicitly afterward, so
-- neither depends on this trigger honoring anything else.
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
    CASE WHEN (NEW.raw_user_meta_data->>'role') IN ('customer', 'organizer')
         THEN (NEW.raw_user_meta_data->>'role')::user_role
         ELSE 'customer'::user_role
    END,
    COALESCE((NEW.raw_user_meta_data->>'verified')::boolean, FALSE)
  );
  RETURN NEW;
END;
$function$;

-- 2. Reject any role change to profiles.role that isn't made by this app's
-- own service-role client, and reject promotion to super_admin outright,
-- full stop, even from the service-role client itself. A future second
-- Super Admin must be a deliberate manual step (temporarily disabling this
-- trigger), never a normal UPDATE through any code path.
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

    IF NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Promotion to super_admin is not permitted via UPDATE.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Explicit WITH CHECK clauses for self-documentation (Postgres already
-- implicitly reuses USING as the check when WITH CHECK is omitted, so this
-- is not a behavior change by itself — prevent_role_escalation above is
-- what actually closes the role-escalation hole).
DROP POLICY IF EXISTS "User updates own profile" ON public.profiles;
CREATE POLICY "User updates own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admin updates any profile" ON public.profiles;
CREATE POLICY "Admin updates any profile" ON public.profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- 3. Stop unauthenticated enumeration of every account's email/role/id.
-- Every legitimate non-admin-API read of profiles in the app is already a
-- self-lookup (.eq("id", user.id)); admin reads of other users' profiles go
-- through app/api/admin/** using the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "Public can read profiles" ON public.profiles;
CREATE POLICY "Users read own profile or admin reads any" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
