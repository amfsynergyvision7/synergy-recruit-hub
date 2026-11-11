-- BUILD 39 REVIEW ONLY. Revoke anonymous EXECUTE on all 16 verified SECURITY DEFINER functions.
-- Preserve authenticated EXECUTE only on 3 RLS role helpers.
-- Function bodies unchanged. Scheduler, Auth and trigger compatibility must be reviewed.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.generate_reminders() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(_user_id uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved(_user_id uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.on_candidate_stage_change() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.on_interview_change() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.on_offer_change() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.on_submission_insert() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_candidate_uuid(_value text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_client_uuid(_value text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_job_uuid(_value text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.run_workflow_rules() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.set_assigned_recruiter() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.track_stage_changes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_approved(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.on_candidate_stage_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.on_interview_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.on_offer_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.on_submission_insert() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_candidate_uuid(_value text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_client_uuid(_value text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_job_uuid(_value text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_workflow_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_assigned_recruiter() TO service_role;
GRANT EXECUTE ON FUNCTION public.track_stage_changes() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid),public.has_role(uuid,public.app_role),public.is_approved(uuid) TO authenticated;
ALTER FUNCTION public.set_assigned_recruiter() SET search_path = pg_catalog, public;
ALTER FUNCTION public.track_stage_changes() SET search_path = pg_catalog, public;
COMMIT;
-- Resolver/authenticated caller mapping and scheduled reminder principal unresolved; NOT FOR PRODUCTION.
