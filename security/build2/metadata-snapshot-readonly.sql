-- READ-ONLY METADATA INSPECTION RECIPE. NOT A MIGRATION.
-- Run only against a specifically approved environment with authorized credentials.
-- These SELECT statements inspect schema security metadata; they do not read business rows.
-- Do not commit raw outputs, secrets, candidate records, or connection strings into a public repository.

-- 1. All exposed public table policies. Capture exact pre-change definitions.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public'
ORDER BY tablename, policyname;

-- 2. RLS enablement / FORCE RLS state on exposed ordinary and partitioned tables.
SELECT n.nspname AS schema_name, c.relname AS object_name,
       c.relkind, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls, pg_get_userbyid(c.relowner) AS owner_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 3. Table-level privileges for API roles. Grants are separate from RLS.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 4. Column grants and update/insert privilege for sensitive profile/role columns.
SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name IN ('profiles','user_roles')
AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name, column_name, grantee, privilege_type;

-- 5. View owners and security_invoker. Do not assume views honor caller RLS.
SELECT n.nspname AS schema_name, c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS owner_name,
       coalesce(c.reloptions,ARRAY[]::text[]) AS view_options
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
ORDER BY c.relname;

-- 6. Function security and callable grants. Review each signature and call path.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname, arguments;

-- 7. Triggers and their backing functions. Never revoke a trigger dependency blindly.
SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name,
       t.tgenabled AS trigger_enabled, p.proname AS function_name
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;

-- 8. Exact public column types, defaults, nullability and generated/identity flags.
-- Required to verify migration compatibility without selecting business records.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       a.attname AS column_name, format_type(a.atttypid,a.atttypmod) AS data_type,
       a.attnotnull AS not_null, a.attidentity AS identity_kind,
       a.attgenerated AS generated_kind,
       pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname,a.attnum;

-- 9. Constraint dependencies: primary/foreign keys, uniqueness and CHECKs.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       con.conname AS constraint_name, con.contype AS constraint_type,
       pg_get_constraintdef(con.oid,true) AS constraint_definition
FROM pg_constraint con
JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
ORDER BY c.relname,con.conname;

-- 10. Exact view definitions, for review of joins and owner bypass.
-- Definitions may include schema identifiers or embedded literals: keep outputs private.
SELECT n.nspname AS schema_name, c.relname AS view_name,
       pg_get_viewdef(c.oid,true) AS view_definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
ORDER BY c.relname;

-- 11. Exact function signatures, ownership, SECURITY DEFINER and search_path.
-- Function source may contain confidential literals: never publish raw output.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner_name,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
ORDER BY p.proname,arguments;

-- 12. Privilege matrix for every public relation and API role.
-- Explicit privilege checks avoid relying solely on information_schema grant visibility.
SELECT n.nspname AS schema_name, c.relname AS object_name,
       c.relkind AS object_kind, role_name,
       has_table_privilege(role_name,c.oid,'SELECT') AS can_select,
       has_table_privilege(role_name,c.oid,'INSERT') AS can_insert,
       has_table_privilege(role_name,c.oid,'UPDATE') AS can_update,
       has_table_privilege(role_name,c.oid,'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) AS api(role_name)
WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
ORDER BY c.relname,role_name;
