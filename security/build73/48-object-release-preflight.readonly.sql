-- Build73 READ-ONLY catalog-only 48-object permission preflight.
-- Never authorizes release, never reads person/business rows, never mutates DB.
-- Expects exact current public object names/signatures and no extra privileged functions.
-- A PASS only verifies limited permissions, not 35-policy, finance, legal, restore or hosted UAT gates.
WITH expected_tables(name) AS (VALUES
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
  ('workflow_rules')
), expected_views(name) AS (VALUES
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
), expected_functions(signature) AS (VALUES
  ('public.generate_reminders()'),
  ('public.get_user_role(uuid)'),
  ('public.handle_new_user()'),
  ('public.has_role(uuid,public.app_role)'),
  ('public.is_approved(uuid)'),
  ('public.on_candidate_stage_change()'),
  ('public.on_interview_change()'),
  ('public.on_offer_change()'),
  ('public.on_submission_insert()'),
  ('public.resolve_candidate_uuid(text)'),
  ('public.resolve_client_uuid(text)'),
  ('public.resolve_job_uuid(text)'),
  ('public.rls_auto_enable()'),
  ('public.run_workflow_rules()'),
  ('public.set_assigned_recruiter()'),
  ('public.track_stage_changes()')
), tab AS (
 SELECT e.name,c.oid,c.relrowsecurity,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'TRUNCATE') END AS anon_truncate,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'TRUNCATE') END AS auth_truncate
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 AND c.relname=e.name AND c.relkind IN ('r','p')
), vw AS (
 SELECT e.name,c.oid,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'SELECT') END AS anon_select,
 CASE WHEN c.oid IS NULL THEN NULL ELSE COALESCE(c.reloptions @> ARRAY['security_invoker=true']::text[],false) END AS invoker
 FROM expected_views e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 AND c.relname=e.name AND c.relkind='v'
), fun AS (
 SELECT e.signature,p.oid,p.prosecdef,
 CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('anon',p.oid,'EXECUTE') END AS anon_execute,
 CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('authenticated',p.oid,'EXECUTE') END AS auth_execute,
 CASE WHEN p.oid IS NULL THEN NULL ELSE EXISTS(
  SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
  WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'
 ) END AS public_execute
 FROM expected_functions e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(e.signature)
), aggregate AS (
 SELECT
 (SELECT count(*) FROM tab WHERE oid IS NOT NULL) AS matched_tables,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS actual_public_tables,
 (SELECT count(*) FROM tab WHERE oid IS NOT NULL AND relrowsecurity) AS tables_rls_enabled,
 (SELECT count(*) FROM tab WHERE anon_truncate IS TRUE) AS anon_truncate_tables,
 (SELECT count(*) FROM tab WHERE auth_truncate IS TRUE) AS authenticated_truncate_tables,
 (SELECT count(*) FROM vw WHERE oid IS NOT NULL) AS matched_views,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v') AS actual_public_views,
 (SELECT count(*) FROM vw WHERE invoker IS TRUE) AS invoker_views,
 (SELECT count(*) FROM vw WHERE anon_select IS TRUE) AS anonymous_readable_views,
 (SELECT count(*) FROM fun WHERE oid IS NOT NULL AND prosecdef) AS matched_privileged_functions,
 (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef) AS actual_privileged_functions,
 (SELECT count(*) FROM fun WHERE anon_execute IS TRUE) AS anonymous_executable_functions,
 (SELECT count(*) FROM fun WHERE public_execute IS TRUE) AS public_executable_functions,
 (SELECT count(*) FROM fun WHERE auth_execute IS TRUE) AS authenticated_executable_functions
)
SELECT *,
 CASE WHEN matched_tables=19 AND actual_public_tables=19 AND tables_rls_enabled=19
 AND anon_truncate_tables=0 AND authenticated_truncate_tables=0
 AND matched_views=13 AND actual_public_views=13 AND invoker_views=13
 AND anonymous_readable_views=0
 AND matched_privileged_functions=16 AND actual_privileged_functions=16
 AND anonymous_executable_functions=0 AND public_executable_functions=0
 AND authenticated_executable_functions=3
 THEN 'PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL'
 ELSE 'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT'
 END AS permissions_gate
FROM aggregate;
