-- Build 136: read-only catalog reconciliation for isolated security test lab
-- Project dhlhlasnaapzckjyvffn only; do not run against production.
-- NO DML, DDL, role switching, grants, auth creation, trigger invocation,
-- credential extraction, customer-row reads, or external actions.
-- Privilege metadata is observed only, NOT changed.
--
-- The 48-object release catalogue is an independent PRODUCTION review scope;
-- this isolated lab has 19 public tables, 13 views and 7 security-definer
-- functions (39 named objects), NOT proof of production schema parity.
WITH relation_inventory AS (
  SELECT c.oid,c.relkind,c.relname,c.relrowsecurity,c.relforcerowsecurity,
         ('security_invoker=true'=ANY(COALESCE(c.reloptions,ARRAY[]::text[]))) AS security_invoker
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','v')
),
privileged_functions AS (
  SELECT p.oid,p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS signature
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
)
SELECT jsonb_build_object(
  'public_tables',(SELECT count(*) FROM relation_inventory WHERE relkind='r'),
  'rls_tables',(SELECT count(*) FROM relation_inventory WHERE relkind='r' AND relrowsecurity),
  'forced_rls_tables',(SELECT count(*) FROM relation_inventory WHERE relkind='r' AND relforcerowsecurity),
  'public_views',(SELECT count(*) FROM relation_inventory WHERE relkind='v'),
  'security_invoker_views',(SELECT count(*) FROM relation_inventory WHERE relkind='v' AND security_invoker),
  'privileged_public_functions',(SELECT count(*) FROM privileged_functions),
  'public_rls_policies',(SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public'),
  'auth_users',(SELECT count(*) FROM auth.users),
  'enabled_public_app_triggers',(SELECT count(*) FROM pg_catalog.pg_trigger t
     JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'),
  'anon_table_select',(SELECT count(*) FROM relation_inventory r WHERE r.relkind='r'
    AND pg_catalog.has_table_privilege('anon',r.oid,'SELECT')),
  'authenticated_table_select',(SELECT count(*) FROM relation_inventory r WHERE r.relkind='r'
    AND pg_catalog.has_table_privilege('authenticated',r.oid,'SELECT')),
  'anon_view_select',(SELECT count(*) FROM relation_inventory r WHERE r.relkind='v'
    AND pg_catalog.has_table_privilege('anon',r.oid,'SELECT')),
  'authenticated_view_select',(SELECT count(*) FROM relation_inventory r WHERE r.relkind='v'
    AND pg_catalog.has_table_privilege('authenticated',r.oid,'SELECT')),
  'anon_secdef_execute',(SELECT count(*) FROM privileged_functions p
    WHERE pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')),
  'authenticated_secdef_execute',(SELECT count(*) FROM privileged_functions p
    WHERE pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))
) AS lab_gate_evidence;
-- A second metadata-only inventory enumerates the object names for exact
-- independent source/target comparison. No function body or real row values.
SELECT 'table' AS kind,c.relname AS name
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
UNION ALL
SELECT 'view',c.relname
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
UNION ALL
SELECT 'security_definer_function',
  p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')'
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY kind,name;
-- Row counts for fixture/readback only. Every table must remain empty until
-- the independent environment reviewer authorizes fictional bootstrap.
SELECT
 (SELECT count(*) FROM public.app_settings) app_settings,
 (SELECT count(*) FROM public.audit_logs) audit_logs,
 (SELECT count(*) FROM public.billing) billing,
 (SELECT count(*) FROM public.candidate_activities) candidate_activities,
 (SELECT count(*) FROM public.candidate_stage_history) candidate_stage_history,
 (SELECT count(*) FROM public.candidates) candidates,
 (SELECT count(*) FROM public.clients) clients,
 (SELECT count(*) FROM public.email_log) email_log,
 (SELECT count(*) FROM public.google_integrations) google_integrations,
 (SELECT count(*) FROM public.integrations) integrations,
 (SELECT count(*) FROM public.interviews) interviews,
 (SELECT count(*) FROM public.job_openings) job_openings,
 (SELECT count(*) FROM public.notifications) notifications,
 (SELECT count(*) FROM public.offers) offers,
 (SELECT count(*) FROM public.profiles) profiles,
 (SELECT count(*) FROM public.submissions) submissions,
 (SELECT count(*) FROM public.sync_logs) sync_logs,
 (SELECT count(*) FROM public.user_roles) user_roles,
 (SELECT count(*) FROM public.workflow_rules) workflow_rules;
