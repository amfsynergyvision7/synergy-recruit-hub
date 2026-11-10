-- READ-ONLY catalog-only JSON exporter for offline schema parity.
-- Run only on approved databases. Output may expose sensitive SQL definitions.
-- Keep exports private and never commit raw exports or connection strings.
-- Each of the nine sections is an array; no business table rows are selected.
SELECT jsonb_build_object(
 'tables',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.object_name) FROM (
  SELECT n.nspname AS schema_name,c.relname AS object_name,c.relkind::text AS object_kind,
  c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')) x),'[]'::jsonb),
 'columns',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.table_name,x.column_name) FROM (
  SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name,
  format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null,
  a.attidentity AS identity_kind,a.attgenerated AS generated_kind,
  pg_get_expr(d.adbin,d.adrelid) AS default_expression
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped) x),'[]'::jsonb),
 'constraints',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.table_name,x.constraint_name) FROM (
  SELECT n.nspname AS schema_name,c.relname AS table_name,con.conname AS constraint_name,
  con.contype::text AS constraint_type,pg_get_constraintdef(con.oid,true) AS constraint_definition
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public') x),'[]'::jsonb),
 'indexes',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.table_name,x.index_name) FROM (
  SELECT n.nspname AS schema_name,c.relname AS table_name,i.relname AS index_name,
  ix.indisunique AS is_unique,ix.indisprimary AS is_primary,
  pg_get_indexdef(i.oid) AS index_definition,pg_get_expr(ix.indpred,ix.indrelid) AS partial_predicate
  FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class c ON c.oid=ix.indrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) x),'[]'::jsonb),
 'views',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.view_name) FROM (
  SELECT n.nspname AS schema_name,c.relname AS view_name,coalesce(c.reloptions,ARRAY[]::text[]) AS view_options,
  pg_get_viewdef(c.oid,true) AS view_definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v') x),'[]'::jsonb),
 'functions',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.function_name,x.arguments) FROM (
  SELECT n.nspname AS schema_name,p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef AS security_definer,
  p.proconfig AS function_settings,pg_get_functiondef(p.oid) AS function_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') x),'[]'::jsonb),
 'policies',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schemaname,x.tablename,x.policyname)
  FROM (SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
  FROM pg_policies WHERE schemaname='public') x),'[]'::jsonb),
 'triggers',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.trigger_name) FROM (
  SELECT c.relname AS table_name,t.tgname AS trigger_name,t.tgenabled::text AS enabled_state,
  pg_get_triggerdef(t.oid,true) AS trigger_definition FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal) x),'[]'::jsonb),
 'grants',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name,x.object_name,x.role_name) FROM (
  SELECT n.nspname AS schema_name,'relation:'||c.relname AS object_name,api.role_name,
  'relation' AS object_type,
  has_table_privilege(api.role_name,c.oid,'SELECT') AS can_select,
  has_table_privilege(api.role_name,c.oid,'INSERT') AS can_insert,
  has_table_privilege(api.role_name,c.oid,'UPDATE') AS can_update,
  has_table_privilege(api.role_name,c.oid,'DELETE') AS can_delete,
  NULL::boolean AS can_execute, NULL::boolean AS can_usage
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS api(role_name)
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
  AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api.role_name)
  UNION ALL
  SELECT n.nspname AS schema_name,'column:'||c.relname||'.'||a.attname AS object_name,
  api.role_name,'column' AS object_type,
  has_column_privilege(api.role_name,c.oid,a.attnum,'SELECT') AS can_select,
  has_column_privilege(api.role_name,c.oid,a.attnum,'INSERT') AS can_insert,
  has_column_privilege(api.role_name,c.oid,a.attnum,'UPDATE') AS can_update,
  NULL::boolean AS can_delete,NULL::boolean AS can_execute,NULL::boolean AS can_usage
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS api(role_name)
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
  AND a.attnum>0 AND NOT a.attisdropped
  AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api.role_name)
  UNION ALL
  SELECT n.nspname AS schema_name,'sequence:'||c.relname AS object_name,
  api.role_name,'sequence' AS object_type,
  has_sequence_privilege(api.role_name,c.oid,'SELECT') AS can_select,
  NULL::boolean AS can_insert,
  has_sequence_privilege(api.role_name,c.oid,'UPDATE') AS can_update,
  NULL::boolean AS can_delete,NULL::boolean AS can_execute,
  has_sequence_privilege(api.role_name,c.oid,'USAGE') AS can_usage
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS api(role_name)
  WHERE n.nspname='public' AND c.relkind='S'
  AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api.role_name)
  UNION ALL
  SELECT n.nspname AS schema_name,'function:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS object_name,
  api.role_name,'function' AS object_type,
  NULL::boolean,NULL::boolean,NULL::boolean,NULL::boolean,
  has_function_privilege(api.role_name,p.oid,'EXECUTE') AS can_execute,NULL::boolean AS can_usage
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS api(role_name)
  WHERE n.nspname='public' AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api.role_name)
  UNION ALL
  SELECT n.nspname AS schema_name,'schema:'||n.nspname AS object_name,api.role_name,
  'schema' AS object_type,
  NULL::boolean,NULL::boolean,NULL::boolean,NULL::boolean,NULL::boolean,
  has_schema_privilege(api.role_name,n.oid,'USAGE') AS can_usage
  FROM pg_namespace n CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS api(role_name)
  WHERE n.nspname='public' AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api.role_name)
 ) x),'[]'::jsonb)
) AS metadata_snapshot;
