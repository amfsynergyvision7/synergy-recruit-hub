-- Build191: disposable PostgreSQL17 ONLY; no Supabase hosted DB, no external users.
-- This is an entirely fabricated 19-table/13-view/16-function/35-policy
-- catalogue to TEST THE QUERY LOGIC, not a rehearsal of live business behavior.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance');
DO $fixture$
DECLARE name text;sig text;
BEGIN
 FOREACH name IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[] LOOP
  EXECUTE format('CREATE TABLE public.%I(id uuid PRIMARY KEY,logo_url text,default_color_theme text,resume_import_folder_url text)',name);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY b191_safe_select ON public.%I FOR SELECT TO authenticated USING(false)',name);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions']::text[] LOOP
  EXECUTE format('CREATE POLICY b191_safe_update ON public.%I FOR UPDATE TO authenticated USING(false) WITH CHECK(false)',name);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[] LOOP
  EXECUTE format('CREATE VIEW public.%I WITH (security_invoker=true) AS SELECT id FROM public.profiles',name);
 END LOOP;
 FOREACH sig IN ARRAY ARRAY['public.generate_reminders()','public.get_user_role(uuid)','public.handle_new_user()','public.has_role(uuid,public.app_role)','public.is_approved(uuid)','public.on_candidate_stage_change()','public.on_interview_change()','public.on_offer_change()','public.on_submission_insert()','public.resolve_candidate_uuid(text)','public.resolve_client_uuid(text)','public.resolve_job_uuid(text)','public.rls_auto_enable()','public.run_workflow_rules()','public.set_assigned_recruiter()','public.track_stage_changes()','public.crm_admin_manage_user(uuid,text,text)','public.crm_update_own_profile(text,text,text)']::text[] LOOP
  EXECUTE format('CREATE FUNCTION %s RETURNS boolean LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='''' AS $synthetic$ SELECT false $synthetic$',sig);
 END LOOP;
END $fixture$;
-- Remove default function PUBLIC grants; do not grant any anonymous table ACL.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(id,logo_url,default_color_theme) ON TABLE public.app_settings TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),public.get_user_role(uuid),public.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_admin_manage_user(uuid,text,text),public.crm_update_own_profile(text,text,text) TO authenticated;
-- 19 SELECT + 16 UPDATE deliberately inert RLS rules = 35 proposed-policy shape.
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE') AS build191_expected_positive \gset
\if :build191_expected_positive
 \echo 'BUILD191_CATALOG_SHAPE_MATCH_IS_REVIEW_ONLY_NOT_REAL_AUTHORIZATION'
\else
 \echo 'BUILD191_FAIL: safe fictional metadata shape unexpectedly rejected'
 SELECT 1/0;
\endif

-- Build191 negative 1: anon SELECT on a restricted CRM table
SAVEPOINT build191_adverse;
GRANT SELECT ON public.candidates TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_1'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 1'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 2: anon INSERT on a restricted CRM table
SAVEPOINT build191_adverse;
GRANT INSERT ON public.candidates TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_2'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 2'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 3: anon UPDATE on a restricted CRM table
SAVEPOINT build191_adverse;
GRANT UPDATE ON public.clients TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_3'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 3'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 4: anon DELETE on a restricted CRM table
SAVEPOINT build191_adverse;
GRANT DELETE ON public.billing TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_4'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 4'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 5: authenticated TRUNCATE bypasses RLS
SAVEPOINT build191_adverse;
GRANT TRUNCATE ON public.candidate_activities TO authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_5'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 5'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 6: authenticated REFERENCES potentially dangerous
SAVEPOINT build191_adverse;
GRANT REFERENCES ON public.profiles TO authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_6'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 6'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 7: browser role INSERT bypass
SAVEPOINT build191_adverse;
GRANT INSERT ON public.user_roles TO authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_7'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 7'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 8: browser profile UPDATE bypass
SAVEPOINT build191_adverse;
GRANT UPDATE ON public.profiles TO authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_8'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 8'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 9: anonymous view SELECT
SAVEPOINT build191_adverse;
GRANT SELECT ON public.recruiter_stats TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_9'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 9'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 10: view changed to owner privileges
SAVEPOINT build191_adverse;
ALTER VIEW public.recruiter_stats SET (security_invoker=false);
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_10'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 10'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 11: anonymous SECURITY DEFINER execution
SAVEPOINT build191_adverse;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_11'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 11'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 12: authenticated required role helper revoked
SAVEPOINT build191_adverse;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_12'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 12'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 13: service privileged function grant lost
SAVEPOINT build191_adverse;
REVOKE EXECUTE ON FUNCTION public.generate_reminders() FROM service_role;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_13'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 13'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 14: public branding table-wide SELECT
SAVEPOINT build191_adverse;
GRANT SELECT ON public.app_settings TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_14'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 14'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 15: anonymous column UPDATE even without table UPDATE
SAVEPOINT build191_adverse;
GRANT UPDATE(logo_url) ON public.app_settings TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_15'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 15'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 16: required public branding column read lost
SAVEPOINT build191_adverse;
REVOKE SELECT(logo_url) ON public.app_settings FROM anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_16'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 16'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 17: unrestricted PUBLIC ALL policy restored
SAVEPOINT build191_adverse;
CREATE POLICY b191_unsafe_all ON public.candidates FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_17'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 17'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 18: one of the proposed policies missing
SAVEPOINT build191_adverse;
DROP POLICY b191_safe_update ON public.candidates;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_18'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 18'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 19: proposed account-management RPC unavailable to authenticated
SAVEPOINT build191_adverse;
REVOKE EXECUTE ON FUNCTION public.crm_admin_manage_user(uuid,text,text) FROM authenticated;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_19'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 19'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 20: anonymous admin RPC invocation
SAVEPOINT build191_adverse;
GRANT EXECUTE ON FUNCTION public.crm_update_own_profile(text,text,text) TO anon;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_20'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 20'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- Build191 negative 21: missing expected base table
SAVEPOINT build191_adverse;
DROP TABLE public.workflow_rules;
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE') AS build191_expected_hold \gset
\if :build191_expected_hold
 \echo 'BUILD191_EXPECTED_HOLD_21'
\else
 \echo 'BUILD191_FAIL: incorrect REVIEW_ONLY result for adverse case 21'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build191_adverse;
RELEASE SAVEPOINT build191_adverse;

-- The last candidate still has the safe but deliberately inert catalogue.
\i /tmp/build191-postflight.gset.sql
SELECT (:'reviewer_gate'='REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE') AS build191_recovered \gset
\if :build191_recovered
 \echo 'BUILD191_SAFE_FIXTURE_RECOVERED_AFTER_21_ADVERSE_CASES'
\else
 SELECT 1/0;
\endif
ROLLBACK;
DO $verify$
BEGIN
 IF to_regclass('public.user_roles') IS NOT NULL OR
 to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL OR
 EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))
 THEN RAISE EXCEPTION 'Build191 disposable privilege fixtures survived ROLLBACK'; END IF;
 RAISE NOTICE 'BUILD191_FULL_CATALOG_ROLLBACK_VERIFIED';
END $verify$;
