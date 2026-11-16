-- Build79 live READ ONLY initial lab inventory for complete 19-table synthetic fixture.
-- Never run this against production. Aggregate counts only, no PII/email/user IDs.
WITH application_rows AS (
 SELECT 'app_settings'::text as table_name, count(*) AS row_count FROM public.app_settings
 UNION ALL
 SELECT 'audit_logs'::text as table_name, count(*) AS row_count FROM public.audit_logs
 UNION ALL
 SELECT 'billing'::text as table_name, count(*) AS row_count FROM public.billing
 UNION ALL
 SELECT 'candidate_activities'::text as table_name, count(*) AS row_count FROM public.candidate_activities
 UNION ALL
 SELECT 'candidate_stage_history'::text as table_name, count(*) AS row_count FROM public.candidate_stage_history
 UNION ALL
 SELECT 'candidates'::text as table_name, count(*) AS row_count FROM public.candidates
 UNION ALL
 SELECT 'clients'::text as table_name, count(*) AS row_count FROM public.clients
 UNION ALL
 SELECT 'email_log'::text as table_name, count(*) AS row_count FROM public.email_log
 UNION ALL
 SELECT 'google_integrations'::text as table_name, count(*) AS row_count FROM public.google_integrations
 UNION ALL
 SELECT 'integrations'::text as table_name, count(*) AS row_count FROM public.integrations
 UNION ALL
 SELECT 'interviews'::text as table_name, count(*) AS row_count FROM public.interviews
 UNION ALL
 SELECT 'job_openings'::text as table_name, count(*) AS row_count FROM public.job_openings
 UNION ALL
 SELECT 'notifications'::text as table_name, count(*) AS row_count FROM public.notifications
 UNION ALL
 SELECT 'offers'::text as table_name, count(*) AS row_count FROM public.offers
 UNION ALL
 SELECT 'profiles'::text as table_name, count(*) AS row_count FROM public.profiles
 UNION ALL
 SELECT 'submissions'::text as table_name, count(*) AS row_count FROM public.submissions
 UNION ALL
 SELECT 'sync_logs'::text as table_name, count(*) AS row_count FROM public.sync_logs
 UNION ALL
 SELECT 'user_roles'::text as table_name, count(*) AS row_count FROM public.user_roles
 UNION ALL
 SELECT 'workflow_rules'::text as table_name, count(*) AS row_count FROM public.workflow_rules
),
summary AS (SELECT
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r') AS tables,
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS enforced_rls_tables,
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='v') AS views,
 (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true']::text[]) AS invoker_views,
 (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT count(*) FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND p.contype IN ('p','u','f','c')) AS constraints,
 (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) AS app_triggers,
 (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'D') AS enabled_app_triggers,
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS app_policies,
 (SELECT count(*) FROM application_rows) AS inventoried_tables,
 (SELECT sum(row_count) FROM application_rows) AS application_fixture_rows,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) AS app_functions,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND
 (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))) AS exposed_app_functions,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND
 ((proname='set_assigned_recruiter' AND md5(pg_get_functiondef(oid))='0b3f5aefd663dae047d866fddc805c96') OR
 (proname='track_stage_changes' AND md5(pg_get_functiondef(oid))='1966ef60466b78a94bd0f700a8ae9468'))
 AND proconfig @> ARRAY['search_path=""']::text[]) AS hardened_function_matches
)
SELECT *,
CASE WHEN tables=19 AND enforced_rls_tables=19 AND views=13 AND invoker_views=13
 AND columns=239 AND constraints=75 AND app_triggers=32 AND enabled_app_triggers=0
 AND auth_users=0 AND app_policies=0 AND inventoried_tables=19 AND application_fixture_rows=0
 AND app_functions=16 AND exposed_app_functions=0 AND hardened_function_matches=2
THEN 'BUILD79_FULL_FIXTURE_PREAUTH_LAB_PASS_NOT_PERMISSION_TO_PROVISION'
ELSE 'HOLD_BUILD79_FULL_FIXTURE_PREAUTH_OR_SOURCE_DRIFT'
END AS live_structural_gate
FROM summary;
