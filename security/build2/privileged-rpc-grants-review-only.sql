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
