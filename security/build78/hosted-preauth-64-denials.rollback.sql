-- Build78: actual hosted PostgreSQL ACL denial checks, pre-Auth fixture only.
-- 32 public CRM objects x 2 nonprivileged database roles = 64 attempted SELECTs.
-- NOT signed GoTrue HTTP/BROWSER UAT and NOT acceptance toward historical 140.
-- Safe in synthetic nonproduction only; transaction always ROLLBACK.
BEGIN;
SET LOCAL statement_timeout = '40s';
DO $pre$ BEGIN
 IF (SELECT count(*) FROM auth.users) <> 0 OR
    (SELECT count(*) FROM public.profiles) <> 0 OR
    (SELECT count(*) FROM public.user_roles) <> 0 OR
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') <> 0 THEN
   RAISE EXCEPTION 'Refusing pre-Auth denials after provisioning or policy activation';
 END IF;
END $pre$;
SET LOCAL ROLE anon;
DO $anon_denial$ DECLARE obj text; denied int:=0; BEGIN
 FOR obj IN SELECT name FROM (VALUES
  ('app_settings'),
  ('audit_logs'),
  ('billing'),
  ('candidate_activities'),
  ('candidate_stage_history'),
  ('candidates'),
  ('clients'),
  ('email_log'),
  ('google_integrations'),
  ('integrations'),
  ('interviews'),
  ('job_openings'),
  ('notifications'),
  ('offers'),
  ('profiles'),
  ('submissions'),
  ('sync_logs'),
  ('user_roles'),
  ('workflow_rules'),
  ('available_recruiters'),
  ('candidates_for_assignment'),
  ('recruiter_performance'),
  ('recruiter_performance_with_names'),
  ('recruiter_stats'),
  ('recruiter_summary'),
  ('vw_billing_filters'),
  ('vw_candidate_filters'),
  ('vw_client_filters'),
  ('vw_interview_filters'),
  ('vw_job_filters'),
  ('vw_offer_filters'),
  ('vw_submission_filters')
 ) AS scope(name) LOOP
   BEGIN
     EXECUTE format('SELECT count(*) FROM public.%I',obj);
   EXCEPTION WHEN insufficient_privilege THEN
     denied:=denied+1; CONTINUE;
   END;
   RAISE EXCEPTION 'Unexpected anon SELECT permission on %',obj;
 END LOOP;
 IF denied<>32 THEN RAISE EXCEPTION 'anon SQL denial count mismatch'; END IF;
END $anon_denial$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $auth_denial$ DECLARE obj text; denied int:=0; BEGIN
 FOR obj IN SELECT name FROM (VALUES
  ('app_settings'),
  ('audit_logs'),
  ('billing'),
  ('candidate_activities'),
  ('candidate_stage_history'),
  ('candidates'),
  ('clients'),
  ('email_log'),
  ('google_integrations'),
  ('integrations'),
  ('interviews'),
  ('job_openings'),
  ('notifications'),
  ('offers'),
  ('profiles'),
  ('submissions'),
  ('sync_logs'),
  ('user_roles'),
  ('workflow_rules'),
  ('available_recruiters'),
  ('candidates_for_assignment'),
  ('recruiter_performance'),
  ('recruiter_performance_with_names'),
  ('recruiter_stats'),
  ('recruiter_summary'),
  ('vw_billing_filters'),
  ('vw_candidate_filters'),
  ('vw_client_filters'),
  ('vw_interview_filters'),
  ('vw_job_filters'),
  ('vw_offer_filters'),
  ('vw_submission_filters')
 ) AS scope(name) LOOP
   BEGIN
     EXECUTE format('SELECT count(*) FROM public.%I',obj);
   EXCEPTION WHEN insufficient_privilege THEN
     denied:=denied+1; CONTINUE;
   END;
   RAISE EXCEPTION 'Unexpected authenticated SELECT permission on %',obj;
 END LOOP;
 IF denied<>32 THEN RAISE EXCEPTION 'authenticated SQL denial count mismatch'; END IF;
END $auth_denial$;
SELECT current_user AS database_role,
       'BUILD78_HOSTED_PREAUTH_SQL_DENIAL_64_OF_64_PASS'::text AS technical_result,
       0::integer AS historical_signed_uat_cases_accepted;
ROLLBACK;
