-- BUILD69: read-only, aggregate-only nonproduction schema readiness preflight.
-- This is NOT a fixture initializer, not release acceptance, and not a migration.
-- Run only through the separately approved dedicated synthetic Supabase project context.
-- It never selects Auth identities, candidate/customer/finance rows or record IDs.
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
), got_tables AS (
 SELECT e.name,c.oid,c.relrowsecurity,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'TRUNCATE') END AS anon_truncate
 FROM expected_tables e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind IN ('r','p')
), got_views AS (
 SELECT e.name,c.oid,
 CASE WHEN c.oid IS NULL THEN NULL ELSE coalesce(c.reloptions @> ARRAY['security_invoker=true']::text[],false) END AS invoker,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'SELECT') END AS anon_select
 FROM expected_views e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind='v'
), observed AS (
 SELECT
 (SELECT count(*) FROM auth.users) AS auth_user_count,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS actual_public_tables,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='v') AS actual_public_views,
 (SELECT count(*) FROM got_tables WHERE oid IS NOT NULL) AS expected_tables_found,
 (SELECT count(*) FROM got_tables WHERE oid IS NOT NULL AND relrowsecurity) AS expected_tables_rls,
 (SELECT count(*) FROM got_tables WHERE anon_truncate IS TRUE) AS expected_anon_truncate_grants,
 (SELECT count(*) FROM got_views WHERE oid IS NOT NULL) AS expected_views_found,
 (SELECT count(*) FROM got_views WHERE invoker IS TRUE) AS expected_security_invoker_views,
 (SELECT count(*) FROM got_views WHERE anon_select IS TRUE) AS expected_anon_readable_views,
 (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public'
 AND tablename='candidate_stage_history') AS candidate_history_policy_count
)
SELECT *,
 CASE WHEN auth_user_count>=9
  AND actual_public_tables=19 AND expected_tables_found=19
  AND actual_public_views=13 AND expected_views_found=13
  AND expected_tables_rls=19
  AND expected_anon_truncate_grants=0
  AND expected_security_invoker_views=13
  AND expected_anon_readable_views=0
  AND candidate_history_policy_count>0
 THEN 'SCHEMA_PREFLIGHT_PASS_NEEDS_INDEPENDENT_FIXTURE_AND_AUTH_UAT'
 ELSE 'HOLD_NONPRODUCTION_SCHEMA_OR_SECURITY_PREREQUISITES_ABSENT'
 END AS schema_preflight_status
FROM observed;
