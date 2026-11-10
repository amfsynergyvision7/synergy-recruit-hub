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
