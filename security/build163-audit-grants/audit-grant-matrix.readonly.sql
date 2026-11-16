-- Build163 metadata-only PostgreSQL17 table ACL / policy evidence, no row reads.
-- The role owner and BYPASSRLS are visible as distinct break-glass risks.
WITH r AS (
 SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_catalog.pg_class c WHERE c.oid='public.audit_logs'::regclass
), principals AS (
 SELECT v.name AS principal,priv.privilege,
   pg_catalog.has_table_privilege(v.name,'public.audit_logs',priv.privilege)
    AS effective_grant
 FROM (VALUES ('anon'),('authenticated'),('service_role')) AS v(name)
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),
  ('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS priv(privilege)
), grants AS (
 SELECT CASE WHEN acl.grantee=0 THEN 'PUBLIC'
  ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
  acl.privilege_type AS privilege,acl.is_grantable AS grant_option
 FROM r CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner))) acl
)
SELECT pg_catalog.pg_get_userbyid(r.relowner) AS audit_table_owner,
 r.relrowsecurity AS rls_enabled,r.relforcerowsecurity AS force_rls,
 (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'role',principal,'permission',privilege,'allowed',effective_grant)
  ORDER BY principal,privilege) FROM principals) AS effective_permission_matrix,
 (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'grantee',grantee,'permission',privilege,'grantable',grant_option)
  ORDER BY grantee,privilege) FROM grants) AS explicit_acl_grants,
 (SELECT count(*) FROM pg_catalog.pg_policies p
  WHERE p.schemaname='public' AND p.tablename='audit_logs'
   AND p.policyname='read audit' AND p.cmd='SELECT'
   AND p.roles::text='{authenticated}'
   AND btrim(coalesce(p.qual,''))='has_role(auth.uid(), ''admin''::app_role)'
  ) AS exact_admin_reader_matches,
 (SELECT count(*) FROM pg_catalog.pg_policies p
  WHERE p.schemaname='public' AND p.tablename='audit_logs') AS total_policies,
 (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'role',rolname,'bypassrls',rolbypassrls,'superuser',rolsuper) ORDER BY rolname),
  '[]'::jsonb) FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role','postgres')
 ) AS role_flags
FROM r;
