-- Read-only, isolated-project catalog gate. Do not run against production.
-- Public CRM tables with RLS enabled but zero policies are deny-by-default
-- for ordinary JWT roles, not proof that the application is usable.
WITH expected(table_name) AS (
  VALUES ('app_settings'),('audit_logs'),('billing'),('candidate_activities'),
    ('candidate_stage_history'),('candidates'),('clients'),('email_log'),
    ('google_integrations'),('integrations'),('interviews'),('job_openings'),
    ('notifications'),('offers'),('profiles'),('submissions'),('sync_logs'),
    ('user_roles'),('workflow_rules')
), observed AS (
  SELECT e.table_name, c.oid, c.relrowsecurity, c.relforcerowsecurity,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
  FROM expected e
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = e.table_name AND c.relkind = 'r'
)
SELECT count(*) AS expected_tables,
  count(oid) AS present_tables,
  count(*) FILTER (WHERE relrowsecurity AND relforcerowsecurity) AS forced_rls_tables,
  count(*) FILTER (WHERE policy_count = 0) AS deny_by_default_tables,
  bool_and(oid IS NOT NULL AND relrowsecurity AND relforcerowsecurity) AS structural_rls_gate,
  bool_and(oid IS NOT NULL AND relrowsecurity AND relforcerowsecurity AND policy_count = 0) AS current_lockdown_snapshot
FROM observed;
