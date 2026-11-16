-- Build66 catalog-only review of four omitted tables and thirteen public views.
-- READ ONLY metadata: no business rows, no schema changes, no permissions granted.
-- Does not demonstrate hosted RLS behavior or authorize deployment.
WITH expected(name,kind) AS (
 VALUES
 ('app_settings','table'),
 ('candidate_stage_history','table'),
 ('email_log','table'),
 ('workflow_rules','table'),
 ('available_recruiters','view'),
 ('candidates_for_assignment','view'),
 ('recruiter_performance','view'),
 ('recruiter_performance_with_names','view'),
 ('recruiter_stats','view'),
 ('recruiter_summary','view'),
 ('vw_billing_filters','view'),
 ('vw_candidate_filters','view'),
 ('vw_client_filters','view'),
 ('vw_interview_filters','view'),
 ('vw_job_filters','view'),
 ('vw_offer_filters','view'),
 ('vw_submission_filters','view')
)
SELECT e.kind,e.name AS public_object,
 c.oid IS NOT NULL AS present,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'SELECT') END AS anon_select_granted,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'SELECT') END AS authenticated_select_granted,
 CASE WHEN e.kind='table' AND c.oid IS NOT NULL THEN c.relrowsecurity ELSE NULL END AS row_security_enabled,
 CASE WHEN e.kind='table' AND c.oid IS NOT NULL THEN has_table_privilege('anon',c.oid,'TRUNCATE') ELSE NULL END AS anon_truncate_granted,
 CASE WHEN e.kind='view' AND c.oid IS NOT NULL THEN coalesce(c.reloptions @> ARRAY['security_invoker=true']::text[],false) ELSE NULL END AS view_is_security_invoker,
 (SELECT count(*) FROM pg_catalog.pg_policies p
  WHERE p.schemaname='public' AND p.tablename=e.name) AS public_rls_policy_count
FROM expected e
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
ORDER BY e.kind,e.name;
