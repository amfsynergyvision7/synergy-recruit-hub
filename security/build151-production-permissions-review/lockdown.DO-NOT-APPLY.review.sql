-- BUILD47 REVIEW-ONLY: 48-object anonymous privilege lockdown and 15 broad RLS policy removal.
-- DO NOT RUN in production/staging. Requires independent signed-user UAT,
-- actual admin / finance workflows, verified backup, protected main and all 9 gates.
-- Based on current READ-ONLY production catalog 11 November 2026.
-- This SQL is intentionally fail-closed on catalog drift, and changes no financial function bodies.
BEGIN;
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
COMMIT;

-- BLOCKERS: Despite hardening these 48 surfaces, this does NOT comprise the
-- final authenticated RLS replacement, admin role/profile updates, column
-- mutation grants, client UI/browser acceptance, or policy/finance approval.
-- Do not merge or deploy until 9 formal release gates pass.
