-- BUILD78: isolated nonproduction ONLY; source-guarded SECURITY DEFINER search-path hardening.
-- Both application triggers stay DISABLED. No auth.users hooks, no GRANT, no seeding.
-- This changes TWO function definition hashes; use Build78 post-hardening
-- preseed checker instead of the historical Build75 source-exact checker.
DO $guard$ BEGIN
  IF (SELECT count(*) FROM auth.users) <> 0 OR
     (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r') <> 19 OR
     (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v') <> 13 OR
     (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled='D') <> 32
  THEN RAISE EXCEPTION 'Build78 refuses changed/non-isolated preseed lab'; END IF;
  IF md5(pg_get_functiondef('public.set_assigned_recruiter()'::regprocedure)) <> 'e400aad0d20359265b58d9718d4f48a4'
  OR md5(pg_get_functiondef('public.track_stage_changes()'::regprocedure)) <> '86c1f9eb50c225a673ae61e82d4e7397'
  THEN RAISE EXCEPTION 'Original source fingerprints drifted; do not harden blindly'; END IF;
END $guard$;

ALTER FUNCTION public.set_assigned_recruiter() SET search_path = '';

CREATE OR REPLACE FUNCTION public.track_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $amf78$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.candidate_stage_history
      (candidate_id, previous_stage, new_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$amf78$;

REVOKE ALL ON FUNCTION public.set_assigned_recruiter() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.track_stage_changes() FROM PUBLIC, anon, authenticated, service_role;

DO $post$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN
   ('public.set_assigned_recruiter()'::regprocedure,'public.track_stage_changes()'::regprocedure)
   AND (NOT p.prosecdef OR p.proconfig IS NULL OR
      NOT 'search_path=""' = ANY(p.proconfig) OR
      has_function_privilege('anon',p.oid,'EXECUTE') OR
      has_function_privilege('authenticated',p.oid,'EXECUTE') OR
      has_function_privilege('service_role',p.oid,'EXECUTE')))
 THEN RAISE EXCEPTION 'Build78 hardened function privilege or search_path drift'; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled <> 'D')
 THEN RAISE EXCEPTION 'Build78 found active application trigger'; END IF;
END $post$;
