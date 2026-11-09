-- Disposable PostgreSQL only. Tests actual privileged RPC GRANT proposal,
-- not production function definitions, scheduler or caller compatibility.
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='build2_rpc_internal') THEN
  CREATE ROLE build2_rpc_internal NOLOGIN;
 END IF;
END $roles$;
CREATE TYPE public.build2_rpc_role AS ENUM ('admin','recruiter');
CREATE FUNCTION public.generate_reminders() RETURNS integer LANGUAGE sql AS $fn$ SELECT 0 $fn$;
CREATE FUNCTION public.get_user_role(uuid) RETURNS text LANGUAGE sql AS $fn$ SELECT 'recruiter'::text $fn$;
CREATE FUNCTION public.has_role(uuid,public.build2_rpc_role) RETURNS boolean LANGUAGE sql AS $fn$ SELECT false $fn$;
CREATE OR REPLACE FUNCTION public.is_approved(uuid) RETURNS boolean LANGUAGE sql AS $fn$ SELECT false $fn$;
CREATE FUNCTION public.resolve_candidate_uuid(text) RETURNS uuid LANGUAGE sql AS $fn$ SELECT NULL::uuid $fn$;
CREATE FUNCTION public.resolve_client_uuid(text) RETURNS uuid LANGUAGE sql AS $fn$ SELECT NULL::uuid $fn$;
CREATE FUNCTION public.resolve_job_uuid(text) RETURNS uuid LANGUAGE sql AS $fn$ SELECT NULL::uuid $fn$;
-- Match actual production signature type without altering existing synthetic helpers.
-- PostgreSQL permits overloaded has_role(uuid,text) and has_role(uuid,app_role).
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance');
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $fn$ SELECT false $fn$;
GRANT EXECUTE ON FUNCTION public.generate_reminders(),public.get_user_role(uuid),
 public.has_role(uuid,public.app_role),public.is_approved(uuid),
 public.resolve_candidate_uuid(text),public.resolve_client_uuid(text),
 public.resolve_job_uuid(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reminders() TO build2_rpc_internal;
-- Review-only SQL tested verbatim in disposable PostgreSQL follows.
-- REVIEW ONLY — DO NOT RUN ON PRODUCTION.
-- Function grant restriction design based on verified live pg_proc.proacl.
-- Does not change function definitions or existing RLS helper logic.
-- Only after confirming no legitimate anonymous RPC callers and verifying
-- scheduler/service-role behavior in isolated PostgreSQL.
BEGIN;
-- Explicit PUBLIC EXECUTE exists on these four functions. Both PUBLIC and
-- anon must be revoked; otherwise anon inherits EXECUTE via PUBLIC.
REVOKE EXECUTE ON FUNCTION public.generate_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
-- These resolver functions have direct anon grants but no explicit PUBLIC grant.
REVOKE EXECUTE ON FUNCTION public.resolve_candidate_uuid(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_client_uuid(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_job_uuid(text) FROM PUBLIC, anon;
-- IMPORTANT: authenticated still has direct EXECUTE on the role and resolver
-- functions. These functions accept arbitrary identifiers and require further
-- redesign before treating the API as safe from authenticated enumeration.
-- IMPORTANT: generate_reminders() scheduling principal must be verified.
-- A SECURITY DEFINER trigger does not require client EXECUTE grants, but
-- trigger creation and execution dependencies must be tested.
-- Service-role and internal function privileges must be verified after changes.
COMMIT;
-- RELEASE BLOCKERS: anonymous caller mapping, RLS helper regression tests,
-- authenticated enumeration mitigation, scheduled reminder test, rollback.


DO $check$
DECLARE sig text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'public.generate_reminders()','public.get_user_role(uuid)',
 'public.has_role(uuid,public.app_role)','public.is_approved(uuid)',
 'public.resolve_candidate_uuid(text)','public.resolve_client_uuid(text)',
 'public.resolve_job_uuid(text)'
 ] LOOP
  IF has_function_privilege('anon',sig,'EXECUTE') THEN
   RAISE EXCEPTION 'anonymous EXECUTE leaked: %',sig;
  END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.generate_reminders()','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated reminder invocation leaked'; END IF;
 IF NOT has_function_privilege('build2_rpc_internal','public.generate_reminders()','EXECUTE')
 THEN RAISE EXCEPTION 'internal scheduler principal lost reminder access'; END IF;
 IF NOT has_function_privilege('authenticated','public.is_approved(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated RLS helper permission broken'; END IF;
 IF NOT has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated role helper permission broken'; END IF;
END $check$;
SELECT 'PASS: actual privileged RPC GRANT proposal denies anon, retains authenticated helpers and internal scheduler principal' AS result;
