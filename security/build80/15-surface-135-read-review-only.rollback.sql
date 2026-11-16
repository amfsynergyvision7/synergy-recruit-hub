-- Build80 REVIEW-ONLY, NON-DEPLOYABLE, TRANSACTION-ROLLED-BACK 135-read-case policy proposal.
-- NOT authorized for production, staging or current hosted nonproduction.
-- Does NOT run 5 write cases. Do not bypass Build79 execution-safety block.
-- All 19 source CRM tables must already have RLS + FORCE RLS and 32 triggers disabled.
-- PostgREST signed token enforcement, schema exposure, recovery and release signoffs
-- REQUIRE independent evidence outside this source file.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='40s';
DO $build80_guard$ BEGIN
 IF (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace
      AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>19
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>0
    OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
         AND t.tgenabled<>'D')<>0
 THEN RAISE EXCEPTION 'Build80 requires isolated review-only RLS baseline'; END IF;
END $build80_guard$;

-- A deliberately non-API, small authenticated-only guard. No caller-supplied
-- target user ID: permissions derive exclusively from the signed subject
-- supplied by PostgREST/GoTrue. Never inspect user-editable user_metadata.
-- SECURITY DEFINER requires independent SECURITY REVIEW before any deployment.
-- One qualifying role per account; multi-role accounts fail closed.
CREATE SCHEMA amf_rls_guard;
REVOKE ALL ON SCHEMA amf_rls_guard FROM PUBLIC, anon, authenticated;
CREATE FUNCTION amf_rls_guard.current_has_role(wanted public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $build80_body$
DECLARE uid uuid;
DECLARE eligible boolean;
BEGIN
 uid:=auth.uid();
 IF uid IS NULL THEN RETURN false; END IF;
 SELECT coalesce(count(*)=1 AND bool_and(ur.role=wanted),false)
   INTO eligible
 FROM public.profiles p
 JOIN public.user_roles ur ON ur.user_id=p.id
 WHERE p.id=uid AND p.status='approved' AND p.is_active=true;
 RETURN coalesce(eligible,false);
END;
$build80_body$;
REVOKE ALL ON FUNCTION amf_rls_guard.current_has_role(public.app_role)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA amf_rls_guard TO authenticated;
GRANT EXECUTE ON FUNCTION amf_rls_guard.current_has_role(public.app_role)
 TO authenticated;

-- The current dedicated hosted lab has zero public policies, no anon grants.
-- All 15 exposed read-table grants are SELECT only. No DML/write privilege.
REVOKE ALL ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,
 public.integrations,public.interviews,public.job_openings,public.notifications,
 public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 FROM anon,authenticated;
GRANT SELECT ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,
 public.integrations,public.interviews,public.job_openings,public.notifications,
 public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 TO authenticated;

-- Account self-reads are allowed for pending/inactive users, but admin-wide
-- visibility requires approved+active unique admin membership.
CREATE POLICY b80_read_profiles ON public.profiles FOR SELECT TO authenticated
 USING (id=(select auth.uid()) OR amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_user_roles ON public.user_roles FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) OR amf_rls_guard.current_has_role('admin'));

-- Approved, active recruiter: their own candidate and job; never peers'.
CREATE POLICY b80_read_candidates ON public.candidates FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   assigned_recruiter=(select auth.uid())));
CREATE POLICY b80_read_job_openings ON public.job_openings FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   assigned_recruiter=(select auth.uid())));

-- Linked recruiter-owned candidate is required for submissions/interviews;
-- no trusting created_by or mutable metadata for authorization.
CREATE POLICY b80_read_submissions ON public.submissions FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id=coalesce(candidate_uuid,candidate_id)
      AND c.assigned_recruiter=(select auth.uid()))));
CREATE POLICY b80_read_interviews ON public.interviews FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id=coalesce(candidate_uuid,candidate_id)
      AND c.assigned_recruiter=(select auth.uid()))));
CREATE POLICY b80_read_notifications ON public.notifications FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   user_id=(select auth.uid())));

-- Restricted finance read is billing only. Nothing here issues invoices.
CREATE POLICY b80_read_billing ON public.billing FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
        amf_rls_guard.current_has_role('finance'));

-- Sensitive internal activity, clients, offers, sync and integrations:
-- unique approved active admin only. A GoTrue account alone has no privileges.
CREATE POLICY b80_read_audit_logs ON public.audit_logs FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_candidate_activities ON public.candidate_activities FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_clients ON public.clients FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_integrations ON public.integrations FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_offers ON public.offers FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_sync_logs ON public.sync_logs FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));

-- Source's historical integration matrix expects one admin-owned row only.
CREATE POLICY b80_read_google_integrations ON public.google_integrations FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') AND
        user_id=(select auth.uid()));

-- Four other application tables intentionally stay default-deny:
-- app_settings (branding decision is separate), candidate_stage_history,
-- email_log and workflow_rules. No anon, any-table DML, view grants or
-- financial activation is introduced.
DO $build80_post$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname='public' AND policyname LIKE 'b80_read_%'
    AND cmd='SELECT' AND roles::text='{authenticated}';
 IF n<>15 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>15
   THEN RAISE EXCEPTION 'Build80 expected exactly 15 authenticated SELECT policies'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND
   (cmd<>'SELECT' OR tablename IN ('app_settings','candidate_stage_history',
     'email_log','workflow_rules'))) THEN
   RAISE EXCEPTION 'Build80 attempted forbidden CRM policy surface'; END IF;
 IF has_table_privilege('anon','public.candidates','SELECT')
   OR has_table_privilege('anon','public.billing','SELECT')
   OR has_table_privilege('authenticated','public.candidates','INSERT')
   OR has_table_privilege('authenticated','public.billing','UPDATE')
   OR has_table_privilege('authenticated','public.offers','DELETE')
   OR has_function_privilege('anon','amf_rls_guard.current_has_role(public.app_role)','EXECUTE')
   THEN RAISE EXCEPTION 'Build80 proposed grant scope is unsafe'; END IF;
END $build80_post$;
ROLLBACK;
-- REVIEW ONLY; NO POLICY/HELPER WAS DEPLOYED IN THIS BUILD.
