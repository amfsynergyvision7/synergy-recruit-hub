-- Build72 disposable PostgreSQL 17 function-permission rehearsal ONLY.
-- All 16 functions are side-effect-free synthetic stubs; real production bodies are NEVER run.
-- Demonstrates why revoking direct anon EXECUTE without revoking PUBLIC remains unsafe.
BEGIN;
SET LOCAL statement_timeout='45s';
CREATE ROLE b72_fn_anon NOLOGIN;
CREATE ROLE b72_fn_authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','operations','finance','viewer');
CREATE FUNCTION public.generate_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN; END; $code$;
CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.on_candidate_stage_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_interview_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_offer_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_submission_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.resolve_candidate_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.resolve_client_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.resolve_job_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN; END; $code$;
CREATE FUNCTION public.run_workflow_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.set_assigned_recruiter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.track_stage_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $code$ BEGIN RETURN NEW; END; $code$;
-- Reconstruct exactly 9 live PUBLIC EXECUTE and 16 direct anon EXECUTE capabilities.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO b72_fn_anon,b72_fn_authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reminders(), public.get_user_role(uuid), public.handle_new_user(), public.has_role(uuid,public.app_role), public.is_approved(uuid), public.rls_auto_enable(), public.run_workflow_rules(), public.set_assigned_recruiter(), public.track_stage_changes() TO PUBLIC;
DO $baseline$
DECLARE total int; public_count int; direct_count int;
BEGIN
 SELECT count(*) INTO total FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('b72_fn_anon',p.oid,'EXECUTE');
 SELECT count(*) INTO public_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef
 AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE');
 SELECT count(*) INTO direct_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef
 AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee='b72_fn_anon'::regrole AND acl.privilege_type='EXECUTE');
 IF total<>16 OR public_count<>9 OR direct_count<>16 THEN
  RAISE EXCEPTION 'Actual source-shaped function grants unexpected: effective %, PUBLIC %, direct %',total,public_count,direct_count; END IF;
END $baseline$;
-- Wrong mitigation: removing the direct role grant alone still leaves PUBLIC permissions.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM b72_fn_anon;
DO $public_fallback$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.prosecdef AND has_function_privilege('b72_fn_anon',p.oid,'EXECUTE');
 IF n<>9 THEN RAISE EXCEPTION 'PUBLIC fallback expected 9 functions still executable, got %',n; END IF;
END $public_fallback$;
-- Correct role and PUBLIC cleanup blocks all 16 direct privileged anonymous calls.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
DO $no_anon$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.prosecdef AND has_function_privilege('b72_fn_anon',p.oid,'EXECUTE');
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous function EXECUTE still inherited on % definitions',n; END IF;
END $no_anon$;
-- Optional authenticated permissions preserve only three RLS helper functions,
-- as in existing Build40 proposal; triggers/schedulers need independent owner review.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM b72_fn_authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid), public.has_role(uuid,public.app_role), public.is_approved(uuid) TO b72_fn_authenticated;
DO $helper_review$
DECLARE n int; unsafe int;
BEGIN
 SELECT count(*) INTO n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.prosecdef AND has_function_privilege('b72_fn_authenticated',p.oid,'EXECUTE');
 SELECT count(*) INTO unsafe FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.prosecdef AND has_function_privilege('b72_fn_anon',p.oid,'EXECUTE');
 IF n<>3 OR unsafe<>0 THEN RAISE EXCEPTION 'Authenticated RLS helper / anon grant mismatch auth % anon %',n,unsafe; END IF;
END $helper_review$;
-- No real function bodies invoked, no records/roles/functions survive the transaction.
ROLLBACK;
