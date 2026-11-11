-- BUILD48 REVIEW ONLY: exact 67-policy replacement, 48-object lockdown, 35 restrictive policies.
-- NO PRODUCTION/STAGING DEPLOYMENT. Finance/management independent acceptance mandatory.
-- Source live catalog: 2026-11-11, 67 policies across 18 tables; 19 security tables,
-- 13 public views, 16 privileged SECURITY DEFINER functions. This is a draft, not active.
-- Entire transaction is atomic, and deliberately errors on any changed live policy.
BEGIN;
DO $exact_legacy$
DECLARE count_p integer; digest text;
BEGIN
 SELECT COUNT(*),md5(string_agg(
    tablename||E'\x1f'||policyname||E'\x1f'||permissive||E'\x1f'||
    roles::text||E'\x1f'||cmd||E'\x1f'||coalesce(qual,'<NULL>')||
    E'\x1f'||coalesce(with_check,'<NULL>'),
    E'\n' ORDER BY tablename,policyname
 )) INTO count_p,digest
 FROM pg_policies WHERE schemaname='public';
 IF count_p<>67 OR digest<>'a70190f31ed8436b2989082898a02b51' THEN
   RAISE EXCEPTION 'Build48 exact 67-policy catalog fingerprint changed; release blocked (% / %)',
     count_p,digest USING ERRCODE='P0001';
 END IF;
END $exact_legacy$;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog,public;

DO $preflight$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   RAISE EXCEPTION 'Expected Supabase API roles missing' USING ERRCODE='P0001';
 END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND c.relrowsecurity;
 IF n<>19 THEN RAISE EXCEPTION '48-object baseline drift: tables RLS % expected 19',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
 AND coalesce('security_invoker=true'=ANY(c.reloptions),false)=false
 AND has_table_privilege('anon',c.oid,'SELECT');
 IF n<>13 THEN RAISE EXCEPTION '48-object baseline drift: exposed views % expected 13',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF n<>16 THEN RAISE EXCEPTION '48-object baseline drift: privileged functions % expected 16',n; END IF;
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[]) AND policyname='Allow all for authenticated'
 AND cmd='ALL' AND permissive='PERMISSIVE' AND roles::text='{public}'
 AND qual='true' AND with_check='true';
 IF n<>15 THEN RAISE EXCEPTION '48-object baseline drift: broad RLS policies % expected 15',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND has_table_privilege('anon',c.oid,'TRUNCATE');
 IF n<>19 THEN RAISE EXCEPTION '48-object baseline drift: anon TRUNCATE % expected 19',n; END IF;
 -- Additional independently verified column requirements from live app_settings.
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_settings' AND column_name='resume_import_folder_url')
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_settings' AND column_name='default_color_theme')
 THEN RAISE EXCEPTION 'Branding/private folder field drift'; END IF;
END $preflight$;

-- RLS PERMISSIVE policies are OR-combined, so merely creating restrictive
-- policies would never neutralize these fifteen universal TRUE policies.
DO $broad$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[]
 LOOP EXECUTE format('DROP POLICY %I ON public.%I','Allow all for authenticated',tab);
 END LOOP;
END $broad$;

-- Anonymous/PUBLIC privileges are unsafe even with RLS: TRUNCATE bypasses RLS.
DO $tables$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[]
 LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon',tab);
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.%I FROM authenticated',tab);
 END LOOP;
END $tables$;
-- Only the approved public branding fields remain accessible to anonymous users.
-- This intentionally removes authenticated app_settings table-level reads/writes;
-- compatible admin settings RPCs and browser UAT are mandatory before release.
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,logo_url,default_color_theme) ON TABLE public.app_settings TO anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;

DO $views$
DECLARE v text;
BEGIN
 FOREACH v IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[]
 LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon',v);
  EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v);
 END LOOP;
END $views$;

-- SECURITY DEFINER functions must not be exposed through inherited PUBLIC EXECUTE.
-- Preserve only the three existing authenticated RLS helpers; service role is
-- explicitly granted all sixteen for server/trigger compatibility testing.
DO $functions$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname
 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  IF f.proname=ANY(ARRAY['get_user_role','has_role','is_approved']::text[]) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $functions$;
-- SECURITY DEFINER search_path safety: use immutable pg_catalog first.
-- The remaining functions' unqualified SQL/body logic needs separate
-- source-equivalent review before changing their function-specific settings.
ALTER FUNCTION public.set_assigned_recruiter() SET search_path=pg_catalog,public;
ALTER FUNCTION public.track_stage_changes() SET search_path=pg_catalog,public;

DO $postflight$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[])
 AND policyname='Allow all for authenticated' AND cmd='ALL';
 IF n<>0 THEN RAISE EXCEPTION 'Universal RLS policies remain: %',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND has_table_privilege('anon',c.oid,'TRUNCATE');
 IF n<>0 THEN RAISE EXCEPTION 'anon TRUNCATE remains: %',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
 AND (has_table_privilege('anon',c.oid,'SELECT') OR NOT
 coalesce('security_invoker=true'=ANY(c.reloptions),false));
 IF n<>0 THEN RAISE EXCEPTION 'Unhardened or exposed views remain: %',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous privileged EXECUTE remains: %',n; END IF;
 IF has_column_privilege('anon','public.app_settings','resume_import_folder_url','SELECT')
 THEN RAISE EXCEPTION 'Anonymous Drive folder settings exposed'; END IF;
 IF NOT has_column_privilege('anon','public.app_settings','logo_url','SELECT')
 OR NOT has_column_privilege('anon','public.app_settings','default_color_theme','SELECT')
 THEN RAISE EXCEPTION 'Public branding compatibility broken'; END IF;
END $postflight$;
DO $drop_52_remaining$
DECLARE p record; dropped integer:=0;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies
 WHERE schemaname='public' ORDER BY tablename,policyname
 LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
   dropped:=dropped+1;
 END LOOP;
 IF dropped<>52 THEN RAISE EXCEPTION 'Expected 52 remaining legacy policies, found %',dropped; END IF;
END $drop_52_remaining$;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated
 USING (id=auth.uid() OR (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin')));
CREATE POLICY profile_admin_update ON public.profiles FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY profile_admin_delete ON public.profiles FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated
 USING (user_id=auth.uid() OR (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin')));
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Deny all anonymous API privileges on the private tables.
REVOKE ALL ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,public.integrations,
 public.interviews,public.job_openings,public.notifications,public.offers,
 public.profiles,public.submissions,public.sync_logs,public.user_roles FROM anon;
-- Protect role/profile writes from accidental broad table grants.
-- Role changes are intended to use a reviewed privileged administrative workflow.
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM authenticated;
-- Admin profile approval / role management workflows must be migrated to a
-- reviewed server-side privileged RPC BEFORE enabling this migration.
-- These revocations intentionally fail closed; current UI admin flows may break.
-- Column privileges and audited server-side workflows are prerequisites:
-- RLS cannot stop a recruiter changing assigned_recruiter while still
-- satisfying WITH CHECK on the new row. Existing UPDATE table grants must
-- be narrowed to explicitly permitted non-ownership columns.
-- Likewise notification UPDATE needs a narrowly granted is_read-only path.
-- These controls are not implemented here. This SQL MUST remain inactive.
-- IMPORTANT: broad table-level UPDATE grants and policy OR-composition can
-- permit owner/recipient reassignment. No release until a verified
-- column-grant strategy and trigger-level immutable ownership check exists.
-- Verify has_role/is_approved SECURITY DEFINER search_path and EXECUTE grants.
-- The draft currently deliberately denies recruiter submission/interview
-- writes and admin UI profile/role writes: these are release blockers.
-- No Operations AI access is granted by these table policies.
CREATE POLICY candidates_read ON public.candidates FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_insert ON public.candidates FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_update ON public.candidates FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())))
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_delete ON public.candidates FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Job ownership is assigned_recruiter, not arbitrary created_by.
CREATE POLICY jobs_read ON public.job_openings FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_insert ON public.job_openings FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_update ON public.job_openings FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())))
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_delete ON public.job_openings FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Relationship-based access: no cross-recruiter submission/interview/offer access.
CREATE POLICY submissions_read ON public.submissions FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND EXISTS
 (SELECT 1 FROM public.candidates c WHERE c.id=coalesce(candidate_uuid,candidate_id) AND c.assigned_recruiter=auth.uid()))));
CREATE POLICY submissions_write ON public.submissions FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY interviews_read ON public.interviews FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND EXISTS
 (SELECT 1 FROM public.candidates c WHERE c.id=coalesce(candidate_uuid,candidate_id) AND c.assigned_recruiter=auth.uid()))));
CREATE POLICY interviews_write ON public.interviews FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY offers_read ON public.offers FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY offers_write ON public.offers FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Financial, integration, audit and sync data are privileged, not generic approved-user.
CREATE POLICY billing_admin_read ON public.billing FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')));
CREATE POLICY billing_admin_write ON public.billing FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY clients_admin_read ON public.clients FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY clients_admin_write ON public.clients FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY activities_read ON public.candidate_activities FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY sync_read ON public.sync_logs FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY integrations_admin ON public.integrations FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY google_integrations_admin ON public.google_integrations FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin') AND user_id=auth.uid())
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin') AND user_id=auth.uid());
-- Notifications: recipient can read and mark own rows; no user-created global messages.
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND (user_id=auth.uid() OR
 public.has_role(auth.uid(),'admin')));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND user_id=auth.uid())
 WITH CHECK (public.is_approved(auth.uid()) AND user_id=auth.uid());
CREATE POLICY notifications_admin_insert ON public.notifications FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- The four tables omitted by the earlier 15-table PR11 RLS proposal are
-- fail-closed by default. Admin/billing/email operational policy must be approved.
CREATE POLICY public_branding_allowlisted ON public.app_settings FOR SELECT TO anon,authenticated
 USING (true);
CREATE POLICY candidate_stage_history_scoped_read ON public.candidate_stage_history
 FOR SELECT TO authenticated USING (
 public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR EXISTS (
 SELECT 1 FROM public.candidates c
 WHERE c.id=candidate_id AND c.assigned_recruiter=auth.uid()
 )));
CREATE POLICY email_log_admin_read ON public.email_log FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY workflow_rules_admin_manage ON public.workflow_rules FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));

-- Column mutation controls required after table grant cleanup, beyond row RLS.
REVOKE UPDATE ON public.candidates,public.job_openings,public.notifications FROM authenticated;
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT UPDATE(status,priority) ON public.job_openings TO authenticated;
GRANT UPDATE(is_read) ON public.notifications TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.user_roles,public.profiles FROM authenticated;
DO $post_67$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN RAISE EXCEPTION 'Expected exactly 35 new approved-for-review policies, got %',n; END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND (
    policyname='Allow all for authenticated'
    OR (tablename='candidates' AND policyname='read candidates')
    OR (tablename='billing' AND policyname='read bill')
    OR (tablename='notifications' AND policyname='update notif')
 );
 IF n<>0 THEN RAISE EXCEPTION 'An old permissive authorization policy survived'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename='app_settings' AND policyname='public_branding_allowlisted')
 THEN RAISE EXCEPTION 'Branding RLS compatibility is absent'; END IF;
 IF has_column_privilege('anon','public.app_settings','resume_import_folder_url','SELECT')
 THEN RAISE EXCEPTION 'Private Drive folder exposed despite RLS'; END IF;
END $post_67$;
-- Same SQL transaction: install the reviewed admin and self-profile
-- compatibility RPCs BEFORE committing the new deny-by-default grants.
CREATE OR REPLACE FUNCTION public.crm_admin_manage_user(
  p_target uuid,
  p_operation text,
  p_value text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $manage$
DECLARE
  v_actor uuid := auth.uid();
  v_target_status public.user_status;
  v_target_active boolean;
  v_old_roles text[];
  v_new_roles text[];
  v_was_admin boolean;
  v_change_revokes_admin boolean;
  v_other_admins integer;
BEGIN
  IF v_actor IS NULL OR p_target IS NULL OR p_operation IS NULL
     OR p_value IS NULL OR length(p_value)>50 THEN
    RAISE EXCEPTION 'Invalid administration request' USING ERRCODE='22023';
  END IF;
  IF p_operation NOT IN ('set_status','set_active','set_role') THEN
    RAISE EXCEPTION 'Unsupported administration action' USING ERRCODE='22023';
  END IF;
  -- The verified JWT identity is the only acting principal. A client cannot
  -- supply p_actor; browser-callable authenticated role has no direct DML grants.
  IF NOT EXISTS(
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=v_actor AND p.status='approved'
      AND p.is_active IS TRUE AND r.role='admin'
  ) THEN RAISE EXCEPTION 'Approved active administrator required' USING ERRCODE='42501'; END IF;
  -- Serialize administrative changes globally, so simultaneous demotions
  -- cannot independently pass the "last active administrator" check.
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_admin_role_and_status',0));
  IF p_target=v_actor THEN
    RAISE EXCEPTION 'Self administration is prohibited' USING ERRCODE='42501';
  END IF;
  SELECT p.status,p.is_active INTO v_target_status,v_target_active
  FROM public.profiles p WHERE p.id=p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE='P0002';
  END IF;
  SELECT coalesce(array_agg(r.role::text ORDER BY r.role::text),ARRAY[]::text[])
    INTO v_old_roles FROM public.user_roles r WHERE r.user_id=p_target;
  v_was_admin:=v_target_status='approved' AND v_target_active AND 'admin'=ANY(v_old_roles);
  IF p_operation='set_status' THEN
    IF p_value NOT IN ('pending','approved','rejected','suspended') THEN
      RAISE EXCEPTION 'Unsupported account status' USING ERRCODE='22023'; END IF;
    v_change_revokes_admin:=p_value<>'approved';
  ELSIF p_operation='set_active' THEN
    IF p_value NOT IN ('true','false') THEN
      RAISE EXCEPTION 'Activation must be true or false' USING ERRCODE='22023'; END IF;
    IF p_value='true' AND v_target_status<>'approved' THEN
      RAISE EXCEPTION 'Cannot activate a nonapproved account' USING ERRCODE='42501'; END IF;
    v_change_revokes_admin:=p_value='false';
  ELSE
    IF p_value NOT IN ('admin','recruiter','operations','finance','viewer') THEN
      RAISE EXCEPTION 'Unsupported account role' USING ERRCODE='22023'; END IF;
    v_change_revokes_admin:=p_value<>'admin';
  END IF;
  IF v_was_admin AND v_change_revokes_admin THEN
    SELECT count(DISTINCT p.id) INTO v_other_admins
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id<>p_target AND p.status='approved'
      AND p.is_active IS TRUE AND r.role='admin';
    IF v_other_admins<1 THEN
      RAISE EXCEPTION 'Cannot revoke the last active administrator' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_operation='set_status' THEN
    UPDATE public.profiles p
       SET status=p_value::public.user_status,
           is_active=(p_value='approved'),
           updated_at=clock_timestamp()
     WHERE p.id=p_target;
  ELSIF p_operation='set_active' THEN
    UPDATE public.profiles p
       SET is_active=(p_value='true'),updated_at=clock_timestamp()
     WHERE p.id=p_target;
  ELSE
    -- Existing CRM UI models one effective role per account. Keep the
    -- replacement and audit in one transaction, unlike delete+insert in UI.
    DELETE FROM public.user_roles WHERE user_id=p_target;
    INSERT INTO public.user_roles(user_id,role)
    VALUES(p_target,p_value::public.app_role);
  END IF;
  SELECT coalesce(array_agg(r.role::text ORDER BY r.role::text),ARRAY[]::text[])
    INTO v_new_roles FROM public.user_roles r WHERE r.user_id=p_target;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,'crm_admin_'||p_operation,
    CASE WHEN p_operation='set_role' THEN 'user_roles' ELSE 'profiles' END,
    p_target::text,
    jsonb_build_object('operation',p_operation,'new_value',p_value,
      'old_status',v_target_status::text,
      'old_active',v_target_active,
      'old_roles',v_old_roles,'new_roles',v_new_roles));
  -- An audit INSERT failure aborts the entire profile/role change.
  RETURN true;
END $manage$;
REVOKE ALL ON FUNCTION public.crm_admin_manage_user(uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_manage_user(uuid,text,text)
 TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_update_own_profile(
  p_full_name text,
  p_phone text,
  p_department text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $self$
DECLARE
  v_actor uuid := auth.uid();
  v_name text := nullif(btrim(p_full_name),'');
  v_phone text := nullif(btrim(p_phone),'');
  v_department text := nullif(btrim(p_department),'');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF v_name IS NULL OR length(v_name)>120
     OR length(coalesce(v_phone,''))>32
     OR length(coalesce(v_department,''))>120 THEN
    RAISE EXCEPTION 'Invalid self-profile fields' USING ERRCODE='22023';
  END IF;
  -- The caller does not provide a target ID, status, role or is_active value.
  -- Only the authenticated user's ordinary, non-privileged fields can change.
  UPDATE public.profiles p
     SET full_name=v_name,phone=v_phone,department=v_department,
         updated_at=clock_timestamp()
   WHERE p.id=v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Self profile not found' USING ERRCODE='P0002';
  END IF;
  -- Log the field names, not phone/name values. Audit failure rolls back edits.
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,'crm_self_profile_update','profiles',v_actor::text,
    jsonb_build_object('fields',jsonb_build_array('full_name','phone','department')));
  RETURN true;
END $self$;
REVOKE ALL ON FUNCTION public.crm_update_own_profile(text,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_update_own_profile(text,text,text) TO authenticated;
DO $b49_compat$
BEGIN
 IF NOT has_function_privilege('authenticated','public.crm_admin_manage_user(uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_update_own_profile(text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Admin/self-profile compatibility RPC missing'; END IF;
 IF has_function_privilege('anon','public.crm_admin_manage_user(uuid,text,text)','EXECUTE')
 OR has_function_privilege('anon','public.crm_update_own_profile(text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Admin/self-profile functions publicly exposed'; END IF;
 IF has_table_privilege('authenticated','public.user_roles','INSERT')
 OR has_table_privilege('authenticated','public.user_roles','DELETE')
 OR has_table_privilege('authenticated','public.profiles','UPDATE')
 THEN RAISE EXCEPTION 'Unsafe direct browser account writes remain'; END IF;
END $b49_compat$;

COMMIT;
-- RELEASE HOLD: The 35 policies are conservative review designs, not signed
-- company policy. Direct admin account approval/profile edits are denied until
-- privileged workflows have passed hosted UAT. Existing mail/workflow UI paths
-- may need further compatibility work. Existing financial triggers unchanged.
