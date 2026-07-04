-- Real account suspension (replaces client-only localStorage flag)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- Super Admin accounts can never be deleted (including via ON DELETE CASCADE
-- from auth.users), and the last remaining Super Admin can never be demoted —
-- there must always be at least one root/owner account.
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

DROP TRIGGER IF EXISTS protect_super_admin_delete ON public.profiles;
CREATE TRIGGER protect_super_admin_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

DROP TRIGGER IF EXISTS protect_super_admin_demote ON public.profiles;
CREATE TRIGGER protect_super_admin_demote
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();
