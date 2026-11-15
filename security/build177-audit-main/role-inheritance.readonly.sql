-- Build178 READ ONLY / DATABASE CATALOGS ONLY / NO BUSINESS OR AUDIT EVENT ROWS.
-- Re-run by an independent DBA on production and dedicated nonproduction.
-- Effective role privileges are not synonymous with successful API reachability.
WITH audited_relation AS (
 SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='audit_logs' AND c.relkind IN ('r','p')
), principals AS (
 SELECT r.oid,r.rolname,r.rolinherit,r.rolbypassrls,r.rolsuper
 FROM pg_catalog.pg_roles r
 WHERE r.rolname IN ('anon','authenticated','service_role','postgres','authenticator')
), members AS (
 SELECT grantee.rolname AS granted_role,member.rolname AS member_role,
 m.inherit_option,m.set_option,m.admin_option
 FROM pg_catalog.pg_auth_members m
 JOIN pg_catalog.pg_roles grantee ON grantee.oid=m.roleid
 JOIN pg_catalog.pg_roles member ON member.oid=m.member
 WHERE member.rolname IN ('anon','authenticated','service_role','postgres','authenticator')
), grants AS (
 SELECT CASE WHEN g.grantee=0 THEN 'PUBLIC'
 ELSE pg_catalog.pg_get_userbyid(g.grantee) END AS grantee,
 g.privilege_type,g.is_grantable
 FROM audited_relation t CROSS JOIN LATERAL pg_catalog.aclexplode(
 coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) AS g
), effective AS (
 SELECT p.rolname,rights.privilege,
 pg_catalog.has_table_privilege(p.rolname,'public.audit_logs',rights.privilege) AS granted
 FROM principals p
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
 ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS rights(privilege)
)
SELECT (SELECT count(*) FROM audited_relation) AS audit_table_count,
 (SELECT relrowsecurity FROM audited_relation) AS rls_enabled,
 (SELECT relforcerowsecurity FROM audited_relation) AS force_rls,
 (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.rolname),'[]'::jsonb) FROM principals p) AS role_flags,
 (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.member_role,m.granted_role),'[]'::jsonb) FROM members m) AS role_memberships,
 (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.grantee,g.privilege_type),'[]'::jsonb) FROM grants g) AS explicit_table_grants,
 (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.rolname,e.privilege),'[]'::jsonb) FROM effective e) AS effective_grants;
