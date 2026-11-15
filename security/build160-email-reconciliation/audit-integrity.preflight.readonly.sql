-- BUILD160 READ-ONLY catalog integrity gate; no business rows are accessed.
WITH funcs AS (
 SELECT p.oid,p.pronargs,p.prosecdef,p.proconfig,
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
 has_table_privilege('authenticated','public.audit_logs','SELECT') AS auth_select,
 has_table_privilege('authenticated','public.audit_logs','INSERT') AS auth_insert,
 has_table_privilege('authenticated','public.audit_logs','UPDATE') AS auth_update,
 has_table_privilege('authenticated','public.audit_logs','DELETE') AS auth_delete,
 has_table_privilege('service_role','public.audit_logs','INSERT') AS service_insert,
 has_table_privilege('service_role','public.audit_logs','UPDATE') AS service_update,
 has_table_privilege('service_role','public.audit_logs','DELETE') AS service_delete,
 has_table_privilege('service_role','public.audit_logs','TRUNCATE') AS service_truncate
), policies AS (
 SELECT count(*) AS broadly_permissive_all
 FROM pg_catalog.pg_policies p
 WHERE p.schemaname='public' AND p.tablename='audit_logs'
 AND p.cmd='ALL' AND p.roles::text LIKE '%public%'
 AND btrim(coalesce(p.qual,''))='true'
 AND btrim(coalesce(p.with_check,''))='true'
), admin_reader AS (
 SELECT count(*) AS admin_select_policies
 FROM pg_catalog.pg_policies p
 WHERE p.schemaname='public' AND p.tablename='audit_logs'
  AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles)
  AND p.qual LIKE '%has_role%' AND p.qual LIKE '%admin%'
), rls AS (
 SELECT relrowsecurity AS rls_enabled
 FROM pg_catalog.pg_class WHERE oid='public.audit_logs'::regclass
), facts AS (
 SELECT (SELECT count(*) FROM funcs) AS named_rpc_count,
 (SELECT count(*) FROM funcs WHERE pronargs=4 AND NOT prosecdef
  AND service_exec AND NOT anon_exec AND NOT auth_exec
  AND array_position(proconfig,'search_path=') IS NOT NULL) AS safe_rpc_count,
 permissions.*,policies.broadly_permissive_all,
 admin_reader.admin_select_policies,rls.rls_enabled
 FROM permissions CROSS JOIN policies CROSS JOIN admin_reader CROSS JOIN rls
)
SELECT named_rpc_count,safe_rpc_count,
 anon_select,anon_insert,anon_update,anon_delete,
 auth_select,auth_insert,auth_update,auth_delete,
 service_insert,service_update,service_delete,service_truncate,
 broadly_permissive_all,admin_select_policies,rls_enabled,
 CASE WHEN named_rpc_count=1 AND safe_rpc_count=1
 AND NOT anon_select AND NOT anon_insert AND NOT anon_update AND NOT anon_delete
 AND auth_select AND NOT auth_insert AND NOT auth_update AND NOT auth_delete
 AND service_insert AND NOT service_update AND NOT service_delete AND NOT service_truncate
 AND broadly_permissive_all=0 AND admin_select_policies>=1 AND rls_enabled
 THEN 'REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE'
 ELSE 'HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT'
 END AS audit_integrity_gate
FROM facts;
