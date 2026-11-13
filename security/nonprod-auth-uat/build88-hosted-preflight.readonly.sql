-- BUILD88: Dedicated NONPROD project only: dhlhlasnaapzckjyvffn
-- READ-ONLY. Run via the approved Supabase SQL editor/management connection.
-- DO NOT run this on production. Zero live candidate information returned.
-- Requires all 19 row counts zero, 0 Auth users, 0 enabled internal app/Auth
-- triggers, forced RLS on all 19 tables, 0 app policies, 0 public grants.
-- Does not create users, policies, rows, extensions, or functions.
WITH live_counts AS (
  SELECT 'profiles'::text AS table_name, count(*)::bigint AS row_count FROM public.profiles
  UNION ALL
  SELECT 'user_roles'::text AS table_name, count(*)::bigint AS row_count FROM public.user_roles
  UNION ALL
  SELECT 'candidates'::text AS table_name, count(*)::bigint AS row_count FROM public.candidates
  UNION ALL
  SELECT 'clients'::text AS table_name, count(*)::bigint AS row_count FROM public.clients
  UNION ALL
  SELECT 'job_openings'::text AS table_name, count(*)::bigint AS row_count FROM public.job_openings
  UNION ALL
  SELECT 'candidate_activities'::text AS table_name, count(*)::bigint AS row_count FROM public.candidate_activities
  UNION ALL
  SELECT 'audit_logs'::text AS table_name, count(*)::bigint AS row_count FROM public.audit_logs
  UNION ALL
  SELECT 'google_integrations'::text AS table_name, count(*)::bigint AS row_count FROM public.google_integrations
  UNION ALL
  SELECT 'integrations'::text AS table_name, count(*)::bigint AS row_count FROM public.integrations
  UNION ALL
  SELECT 'candidate_stage_history'::text AS table_name, count(*)::bigint AS row_count FROM public.candidate_stage_history
  UNION ALL
  SELECT 'submissions'::text AS table_name, count(*)::bigint AS row_count FROM public.submissions
  UNION ALL
  SELECT 'interviews'::text AS table_name, count(*)::bigint AS row_count FROM public.interviews
  UNION ALL
  SELECT 'offers'::text AS table_name, count(*)::bigint AS row_count FROM public.offers
  UNION ALL
  SELECT 'billing'::text AS table_name, count(*)::bigint AS row_count FROM public.billing
  UNION ALL
  SELECT 'notifications'::text AS table_name, count(*)::bigint AS row_count FROM public.notifications
  UNION ALL
  SELECT 'sync_logs'::text AS table_name, count(*)::bigint AS row_count FROM public.sync_logs
  UNION ALL
  SELECT 'app_settings'::text AS table_name, count(*)::bigint AS row_count FROM public.app_settings
  UNION ALL
  SELECT 'email_log'::text AS table_name, count(*)::bigint AS row_count FROM public.email_log
  UNION ALL
  SELECT 'workflow_rules'::text AS table_name, count(*)::bigint AS row_count FROM public.workflow_rules
),
  conditions AS (
    SELECT
      (SELECT count(*)::int FROM auth.users) AS auth_users,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') AS public_rls_policies,
      (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled <> 'D')
          AS enabled_app_triggers,
      (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         WHERE c.relnamespace='auth'::regnamespace AND c.relname='users'
         AND NOT t.tgisinternal AND t.tgenabled <> 'D') AS enabled_auth_user_triggers,
      (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace
         AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity))
         AS unprotected_public_tables,
      (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace
         AND c.relkind='r' AND (
           has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         )) AS public_tables_with_caller_grants,
      (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace
         AND c.relkind='v' AND (
           has_table_privilege('anon',c.oid,'SELECT') OR
           has_table_privilege('authenticated',c.oid,'SELECT')
         )) AS exposed_public_views,
      (SELECT count(*)::int FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
         AND (
           has_function_privilege('anon',p.oid,'EXECUTE') OR
           has_function_privilege('authenticated',p.oid,'EXECUTE')
         )) AS callable_public_functions
  )
SELECT
  (SELECT jsonb_agg(jsonb_build_object('table',table_name,'count',row_count)
             ORDER BY table_name) FROM live_counts) AS table_counts,
  (SELECT sum(row_count) FROM live_counts) AS total_fixture_rows,
  auth_users, public_rls_policies, enabled_app_triggers, enabled_auth_user_triggers,
  unprotected_public_tables, public_tables_with_caller_grants,
  exposed_public_views, callable_public_functions,
  (
    (SELECT count(*) FROM live_counts)=19
    AND (SELECT coalesce(sum(row_count),-1) FROM live_counts)=0
    AND auth_users=0 AND public_rls_policies=0
    AND enabled_app_triggers=0 AND enabled_auth_user_triggers=0
    AND unprotected_public_tables=0 AND public_tables_with_caller_grants=0
    AND exposed_public_views=0 AND callable_public_functions=0
  ) AS ready_for_reviewed_synthetic_provisioning
FROM conditions;
