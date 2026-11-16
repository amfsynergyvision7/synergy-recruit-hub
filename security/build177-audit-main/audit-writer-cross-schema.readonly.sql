-- BUILD185 READ-ONLY METADATA-ONLY WRITER INVENTORY. NO BUSINESS/AUDIT ROWS.
-- This identifies static SQL literal references and dependency links across
-- non-system schemas. It CANNOT prove absence of external/dynamic/historical writers.
-- Reviewer must independently inventory all application, trigger, import, job,
-- service, API, provider and migration paths before ANY grant/RLS changes.
WITH target AS (SELECT pg_catalog.to_regclass('public.audit_logs') AS oid),
routines AS (
 SELECT n.nspname AS schema_name,p.proname AS object_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  (pg_catalog.pg_get_functiondef(p.oid) ~*
   '(^|[^[:alnum:]_])audit_logs([^[:alnum:]_]|$)') AS literal_match,p.oid
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n
  ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND n.nspname NOT LIKE 'pg_temp%'
  AND p.prokind IN ('f','p')
), triggers AS (
 SELECT ns.nspname AS table_schema,c.relname AS table_name,
  t.tgname AS trigger_name,pn.nspname AS function_schema,
  p.proname AS function_name,
  t.tgrelid=(SELECT oid FROM target) AS on_target,
  coalesce(r.literal_match,false) AS invokes_literal_match
 FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
 JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
 LEFT JOIN routines r ON r.oid=p.oid
 WHERE NOT t.tgisinternal
  AND (t.tgrelid=(SELECT oid FROM target) OR coalesce(r.literal_match,false))
), views AS (
 SELECT DISTINCT ns.nspname AS schema_name,c.relname AS view_name
 FROM pg_catalog.pg_depend d
 JOIN pg_catalog.pg_rewrite w
  ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=w.oid
 JOIN pg_catalog.pg_class c ON c.oid=w.ev_class
 JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
 WHERE d.refobjid=(SELECT oid FROM target) AND c.relkind IN ('v','m')
)
SELECT CASE WHEN (SELECT oid FROM target) IS NULL
 THEN 'HOLD_TARGET_TABLE_MISSING'
 ELSE 'REVIEW_ONLY_NOT_PROOF_OF_ABSENCE_OF_EXTERNAL_OR_DYNAMIC_WRITERS'
 END AS inventory_gate,
 (SELECT count(*) FROM routines) AS checked_routines,
 (SELECT count(*) FROM routines WHERE literal_match) AS literal_routine_matches,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'schema',schema_name,'name',object_name,'args',arguments,
  'security_definer',security_definer)
  ORDER BY schema_name,object_name,arguments),'[]'::jsonb)
  FROM routines WHERE literal_match) AS routine_identifiers,
 (SELECT count(*) FROM triggers) AS trigger_matches,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'schema',table_schema,'table',table_name,'trigger',trigger_name,
  'function_schema',function_schema,'function',function_name,
  'on_target',on_target,'literal_match',invokes_literal_match)
  ORDER BY table_schema,table_name,trigger_name),'[]'::jsonb)
  FROM triggers) AS trigger_identifiers,
 (SELECT count(*) FROM views) AS dependent_views,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'schema',schema_name,'view',view_name) ORDER BY schema_name,view_name),
  '[]'::jsonb) FROM views) AS view_identifiers;