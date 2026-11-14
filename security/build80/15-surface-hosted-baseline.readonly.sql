-- Build80 READ ONLY: live isolated nonproduction 15-surface/4-deny authorization baseline.
-- Never invokes SQL role spoofing, inserts records or tests a signed GoTrue token.
-- Precise absence of policy and app grants is deliberate until independent acceptance.
WITH scoped AS (
 SELECT c.oid,c.relname AS table_name,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_read,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS app_write
 FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
 AND c.relname=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','app_settings','candidate_stage_history','email_log','workflow_rules']::text[])
), read15 AS (SELECT * FROM scoped
 WHERE table_name=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[])),
 denied4 AS (SELECT * FROM scoped
 WHERE table_name=ANY(ARRAY['app_settings','candidate_stage_history','email_log','workflow_rules']::text[])),
 checks AS (SELECT
 (SELECT count(*) FROM read15) table_scoped_read_surfaces,
 (SELECT count(*) FROM read15 WHERE relrowsecurity AND relforcerowsecurity) forced_rls_read_surfaces,
 (SELECT count(*) FROM read15 WHERE anon_read) anon_granted_read_surfaces,
 (SELECT count(*) FROM read15 WHERE authenticated_read) authenticated_granted_read_surfaces,
 (SELECT count(*) FROM read15 WHERE app_write) authenticated_granted_write_surfaces,
 (SELECT count(*) FROM denied4) default_denied_surfaces,
 (SELECT count(*) FROM denied4 WHERE anon_read OR authenticated_read OR app_write) unsafe_default_denied_surfaces,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public') installed_app_policies,
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace
  AND c.relkind='v' AND
    c.reloptions @> ARRAY['security_invoker=true']::text[]
  AND NOT has_table_privilege('anon',c.oid,'SELECT')
  AND NOT has_table_privilege('authenticated',c.oid,'SELECT')) invoker_unreadable_views,
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace
    AND c.relkind='v') total_app_views,
 (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace) public_functions,
 (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR
         has_function_privilege('authenticated',p.oid,'EXECUTE'))) callable_app_functions,
 (SELECT count(*) FROM pg_namespace WHERE nspname='amf_rls_guard') proposed_helper_schemas_installed,
 (SELECT count(*) FROM auth.users) auth_users
)
SELECT *,
CASE WHEN table_scoped_read_surfaces=15 AND forced_rls_read_surfaces=15
  AND anon_granted_read_surfaces=0 AND authenticated_granted_read_surfaces=0
  AND authenticated_granted_write_surfaces=0
  AND default_denied_surfaces=4 AND unsafe_default_denied_surfaces=0
  AND installed_app_policies=0 AND invoker_unreadable_views=13
  AND total_app_views=13 AND public_functions=16 AND callable_app_functions=0
  AND proposed_helper_schemas_installed=0 AND auth_users=0
 THEN 'BUILD80_LIVE_15_SURFACE_DENY_BASELINE_PASS_NOT_SIGNED_UAT'
 ELSE 'HOLD_BUILD80_LIVE_READ_POLICY_BOUNDARY_DRIFT'
END AS live_baseline_gate,
0::integer AS actual_135_signed_read_cases_executed,
0::integer AS accepted_release_cases
FROM checks;
