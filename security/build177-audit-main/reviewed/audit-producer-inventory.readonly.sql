-- Build162 READ ONLY catalog object inventory. No audit or business rows.
-- Objects from external services, dynamic SQL and other schemas need human review.
WITH target AS (
 SELECT pg_catalog.to_regclass('public.audit_logs') AS audit_oid
), routine AS (
 SELECT p.oid,n.nspname,p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef,
  pg_catalog.pg_get_functiondef(p.oid) ~*
  '(^|[^[:alnum:]_])audit_logs([^[:alnum:]_]|$)' AS refers
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind IN ('f','p')
), triggers AS (
 SELECT n.nspname,c.relname,t.tgname,p.proname AS function_name,
  t.tgrelid=(SELECT audit_oid FROM target) AS on_audit_table
 FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
 LEFT JOIN routine r ON r.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','private')
 AND (t.tgrelid=(SELECT audit_oid FROM target) OR coalesce(r.refers,false))
), views AS (
 SELECT DISTINCT n.nspname,c.relname
 FROM pg_catalog.pg_rewrite w
 JOIN pg_catalog.pg_class c ON c.oid=w.ev_class
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass
  AND d.objid=w.oid
 WHERE c.relkind IN ('v','m') AND n.nspname IN ('public','private')
 AND d.refobjid=(SELECT audit_oid FROM target)
)
SELECT CASE WHEN (SELECT audit_oid FROM target) IS NULL
 THEN 'HOLD_AUDIT_TABLE_MISSING' ELSE 'REVIEW_EXTERNAL_AUDIT_PRODUCERS_REQUIRED'
 END AS inventory_gate,
 (SELECT count(*) FROM routine WHERE refers) AS function_literal_matches,
 (SELECT count(*) FROM triggers) AS trigger_matches,
 (SELECT count(*) FROM views) AS view_dependencies,
 (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'schema',nspname,'name',proname,'arguments',args,'definer',prosecdef)
 ORDER BY nspname,proname,args),'[]'::jsonb)
 FROM routine WHERE refers) AS function_identifiers,
 (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'schema',nspname,'table',relname,'trigger',tgname,'function',function_name,
 'on_audit_table',on_audit_table) ORDER BY nspname,relname,tgname),
 '[]'::jsonb) FROM triggers) AS trigger_identifiers,
 (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'schema',nspname,'view',relname) ORDER BY nspname,relname),'[]'::jsonb)
 FROM views) AS view_identifiers;
