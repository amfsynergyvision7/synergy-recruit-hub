-- Build186 READ-ONLY cross-schema role-helper dependency inventory.
-- Catalog expressions and routine identifiers ONLY; NO users/roles/business rows.
-- A policy mentioning has_role is a static dependency, not a runtime UAT result.
-- This query must never be used to auto-revoke, rewrite or publish RLS changes.
WITH helper AS (
 SELECT p.oid,pg_catalog.pg_get_userbyid(p.proowner) AS helper_owner,
  p.prosecdef AS security_definer,p.proconfig::text AS helper_settings,
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
 FROM pg_catalog.pg_proc p
 WHERE p.oid=pg_catalog.to_regprocedure('public.has_role(uuid,public.app_role)')
), policy_refs AS (
 SELECT schemaname,tablename,policyname,cmd,roles::text AS policy_roles
 FROM pg_catalog.pg_policies
 WHERE (coalesce(qual,'')||' '||coalesce(with_check,'')) ~*
  '(^|[^[:alnum:]_])has_role[[:space:]]*\('
), routine_refs AS (
 SELECT n.nspname AS routine_schema,p.proname AS routine_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS signature
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND n.nspname NOT LIKE 'pg_temp%'
  AND p.prokind IN ('f','p')
  AND p.oid IS DISTINCT FROM (SELECT oid FROM helper)
  AND pg_catalog.pg_get_functiondef(p.oid) ~*
  '(^|[^[:alnum:]_])has_role[[:space:]]*\('
)
SELECT CASE WHEN (SELECT count(*) FROM helper)=0
 THEN 'HOLD_HELPER_ABSENT_DEPENDENT_POLICIES_STILL_NEED_REVIEW'
 ELSE 'HOLD_STATIC_HELPER_CALLER_INVENTORY_REQUIRES_OWNER_REVIEW'
 END AS release_gate,
 (SELECT count(*) FROM pg_catalog.pg_policies) AS total_policies_in_all_schemas,
 (SELECT count(*) FROM policy_refs) AS policy_text_dependencies,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
 'schema',schemaname,'table',tablename,'policy',policyname,
 'command',cmd,'roles',policy_roles)
 ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
 FROM policy_refs) AS policy_identifiers,
 (SELECT count(*) FROM routine_refs) AS routine_text_dependencies,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'schema',routine_schema,'name',routine_name,'args',signature)
  ORDER BY routine_schema,routine_name,signature),'[]'::jsonb)
  FROM routine_refs) AS dependent_routines,
 (SELECT jsonb_build_object(
  'owner',helper_owner,'security_definer',security_definer,
  'search_path',helper_settings,'anon_execute',anon_execute,
  'authenticated_execute',authenticated_execute) FROM helper)
 AS current_helper_metadata;