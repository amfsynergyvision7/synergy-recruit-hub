-- BUILD179 PROPOSED PG17-CORRECTED READ-ONLY CATALOG REVIEW. NOT RELEASE AUTHORIZATION.
-- Original BUILD160 SQL preserved byte-for-byte in reviewed/ directory.
-- A correct catalog-only result is REVIEW_ONLY, never email or production approval.
-- Build181 rejects PROCEDURE/scalar/wrong TABLE-return routines that share
-- the RPC name, input signature, search_path and EXECUTE privileges.
-- Build184 checks exact four PostgREST named input arguments.
-- Build186 adds a fail-closed audit-reader dependency check for public.has_role.
-- A catalog match never proves safe helper semantics or authentic user identity.
-- Build180 adds safeguards against BYPASSRLS drift, app-role table ownership
-- and restrictive-only admin SELECT policies. It does not prove function semantics.
WITH funcs AS (
 SELECT p.oid,p.pronargs,p.proargtypes,p.prokind,p.proretset,p.prorettype,
  p.proallargtypes,p.proargmodes,p.proargnames,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='crm_email_confirm_sent_trusted'
), permissions AS (
 SELECT
 has_table_privilege('anon','public.audit_logs','SELECT') AS anon_select,
 has_table_privilege('anon','public.audit_logs','INSERT') AS anon_insert,
 has_table_privilege('anon','public.audit_logs','UPDATE') AS anon_update,
 has_table_privilege('anon','public.audit_logs','DELETE') AS anon_delete,
 has_table_privilege('anon','public.audit_logs','TRUNCATE') AS anon_truncate,
 has_table_privilege('anon','public.audit_logs','REFERENCES') AS anon_references,
 has_table_privilege('anon','public.audit_logs','TRIGGER') AS anon_trigger,
 has_table_privilege('anon','public.audit_logs','MAINTAIN') AS anon_maintain,
 has_table_privilege('authenticated','public.audit_logs','SELECT') AS auth_select,
 has_table_privilege('authenticated','public.audit_logs','INSERT') AS auth_insert,
 has_table_privilege('authenticated','public.audit_logs','UPDATE') AS auth_update,
 has_table_privilege('authenticated','public.audit_logs','DELETE') AS auth_delete,
 has_table_privilege('authenticated','public.audit_logs','TRUNCATE') AS auth_truncate,
 has_table_privilege('authenticated','public.audit_logs','REFERENCES') AS auth_references,
 has_table_privilege('authenticated','public.audit_logs','TRIGGER') AS auth_trigger,
 has_table_privilege('authenticated','public.audit_logs','MAINTAIN') AS auth_maintain,
 has_table_privilege('service_role','public.audit_logs','INSERT') AS service_insert,
 has_table_privilege('service_role','public.audit_logs','UPDATE') AS service_update,
 has_table_privilege('service_role','public.audit_logs','DELETE') AS service_delete,
 has_table_privilege('service_role','public.audit_logs','TRUNCATE') AS service_truncate,
 has_table_privilege('service_role','public.audit_logs','REFERENCES') AS service_references,
 has_table_privilege('service_role','public.audit_logs','TRIGGER') AS service_trigger,
 has_table_privilege('service_role','public.audit_logs','MAINTAIN') AS service_maintain
), policies AS (
 SELECT count(*) AS total_audit_policies,
 count(*) FILTER (
  WHERE p.cmd='ALL' AND p.roles::text LIKE '%public%'
   AND btrim(coalesce(p.qual,''))='true'
   AND btrim(coalesce(p.with_check,''))='true'
 ) AS broadly_permissive_all
 FROM pg_catalog.pg_policies p
 WHERE p.schemaname='public' AND p.tablename='audit_logs'
), admin_reader AS (
 SELECT count(*) AS admin_select_policies
 FROM pg_catalog.pg_policies p
 WHERE p.schemaname='public' AND p.tablename='audit_logs'
  AND p.cmd='SELECT' AND p.policyname='read audit'
  AND p.permissive='PERMISSIVE'
  AND p.roles::text='{authenticated}'
  AND btrim(coalesce(p.qual,''))='has_role(auth.uid(), ''admin''::app_role)'
), admin_helper AS (
 -- The proposed admin RLS reader relies on public.has_role(uuid,app_role).
 -- Require hardened SECURITY DEFINER metadata, pinned empty search_path,
 -- no anonymous EXECUTE, authenticated EXECUTE and trusted ownership.
 -- This is necessary catalog evidence, NEVER sufficient behavior evidence.
 SELECT count(*) AS safe_admin_helper_count
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
  AND p.oid=to_regprocedure('public.has_role(uuid,public.app_role)')
  AND p.prokind='f' AND p.prosecdef AND p.prorettype='boolean'::regtype
  AND p.pronargs=2
  AND p.proargtypes[0]='uuid'::regtype
  AND p.proargtypes[1]='public.app_role'::regtype
  AND array_position(p.proconfig,'search_path=""') IS NOT NULL
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  AND pg_get_userbyid(p.proowner) NOT IN ('anon','authenticated','service_role')
), rls AS (
 SELECT relrowsecurity AS rls_enabled,
  -- A data API principal owning this table could bypass RLS unless FORCE
  -- is enabled. Ownership drift should never count as an acceptable review.
  pg_get_userbyid(relowner) NOT IN ('anon','authenticated','service_role')
    AS independent_table_owner
 FROM pg_catalog.pg_class WHERE oid='public.audit_logs'::regclass
), app_rls_roles AS (
 SELECT
  coalesce((SELECT NOT (rolbypassrls OR rolsuper)
   FROM pg_catalog.pg_roles WHERE rolname='anon'),false) AS anon_rls_enforced,
  coalesce((SELECT NOT (rolbypassrls OR rolsuper)
   FROM pg_catalog.pg_roles WHERE rolname='authenticated'),false) AS auth_rls_enforced
), facts AS (
 SELECT (SELECT count(*) FROM funcs) AS named_rpc_count,
 (SELECT count(*) FROM funcs WHERE pronargs=4 AND prokind='f'
  AND proretset AND prorettype='record'::regtype
  -- Original reviewed RPC returns TABLE(id uuid,status text).
  -- pg_proc stores these TABLE outputs with mode "t"; a procedure, scalar
  -- function or incompatible column shape must NEVER count as the RPC.
  AND array_length(proallargtypes,1)=6
  AND proallargtypes[5]='uuid'::regtype
  AND proallargtypes[6]='text'::regtype
  AND proargmodes[5]='t' AND proargmodes[6]='t'
  AND proargnames[5]='id' AND proargnames[6]='status'
  AND NOT prosecdef
  AND proargtypes[0]='uuid'::regtype AND proargtypes[1]='uuid'::regtype
  AND proargtypes[2]='text'::regtype AND proargtypes[3]='text'::regtype
  -- Named PostgREST RPC dispatch also depends on input parameter names.
  AND proargnames[1]='p_attempt' AND proargnames[2]='p_admin'
  AND proargnames[3]='p_case_ref' AND proargnames[4]='p_provider_id'
  AND service_exec AND NOT anon_exec AND NOT auth_exec
  -- PG17 stores explicitly empty search_path as the string search_path="".
  AND array_position(proconfig,'search_path=""') IS NOT NULL) AS safe_rpc_count,
 permissions.*,policies.broadly_permissive_all,policies.total_audit_policies,
 admin_reader.admin_select_policies,admin_helper.safe_admin_helper_count,
 has_schema_privilege('authenticated','public','USAGE') AS auth_public_schema_usage,
 rls.rls_enabled,rls.independent_table_owner,
 app_rls_roles.anon_rls_enforced,app_rls_roles.auth_rls_enforced
 FROM permissions CROSS JOIN policies CROSS JOIN admin_reader CROSS JOIN admin_helper
 CROSS JOIN rls CROSS JOIN app_rls_roles
)
SELECT named_rpc_count,safe_rpc_count,
 anon_select,anon_insert,anon_update,anon_delete,anon_truncate,
 anon_references,anon_trigger,anon_maintain,
 auth_select,auth_insert,auth_update,auth_delete,auth_truncate,
 auth_references,auth_trigger,auth_maintain,
 service_insert,service_update,service_delete,service_truncate,
 service_references,service_trigger,service_maintain,
 broadly_permissive_all,total_audit_policies,admin_select_policies,
 safe_admin_helper_count,auth_public_schema_usage,rls_enabled,
 independent_table_owner,anon_rls_enforced,auth_rls_enforced,
 CASE WHEN named_rpc_count=1 AND safe_rpc_count=1
 AND NOT anon_select AND NOT anon_insert AND NOT anon_update AND NOT anon_delete
 AND NOT anon_truncate AND NOT anon_references
 AND NOT anon_trigger AND NOT anon_maintain
 AND auth_select AND NOT auth_insert AND NOT auth_update AND NOT auth_delete
 AND NOT auth_truncate AND NOT auth_references
 AND NOT auth_trigger AND NOT auth_maintain
 AND service_insert AND NOT service_update AND NOT service_delete AND NOT service_truncate
 AND NOT service_references AND NOT service_trigger AND NOT service_maintain
 AND broadly_permissive_all=0 AND total_audit_policies=1
 AND admin_select_policies=1 AND safe_admin_helper_count=1
 AND auth_public_schema_usage AND rls_enabled
 AND independent_table_owner AND anon_rls_enforced AND auth_rls_enforced
 THEN 'REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE'
 ELSE 'HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT'
 END AS audit_integrity_gate
FROM facts;
