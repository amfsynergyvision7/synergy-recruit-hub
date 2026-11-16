-- BUILD191: READ-ONLY candidate postflight (19 tables, 13 views, 16 definer
-- funcs, two separately reviewed account RPCs and exact 35 RLS policies).
-- DO NOT treat REVIEW_ONLY as deployment approval. No business rows read.
-- Unlike legacy Build73 postflight, this refuses anon INSERT/UPDATE/DELETE,
-- bad public column grants, account writes, view or definer exposure.
WITH expected_tables(name) AS (VALUES
 ('app_settings'),
 ('audit_logs'),
 ('billing'),
 ('candidate_activities'),
 ('candidate_stage_history'),
 ('candidates'),
 ('clients'),
 ('email_log'),
 ('google_integrations'),
 ('integrations'),
 ('interviews'),
 ('job_openings'),
 ('notifications'),
 ('offers'),
 ('profiles'),
 ('submissions'),
 ('sync_logs'),
 ('user_roles'),
 ('workflow_rules')
), expected_views(name) AS (VALUES
 ('available_recruiters'),
 ('candidates_for_assignment'),
 ('recruiter_performance'),
 ('recruiter_performance_with_names'),
 ('recruiter_stats'),
 ('recruiter_summary'),
 ('vw_billing_filters'),
 ('vw_candidate_filters'),
 ('vw_client_filters'),
 ('vw_interview_filters'),
 ('vw_job_filters'),
 ('vw_offer_filters'),
 ('vw_submission_filters')
), expected_functions(signature) AS (VALUES
 ('public.generate_reminders()'),
 ('public.get_user_role(uuid)'),
 ('public.handle_new_user()'),
 ('public.has_role(uuid,public.app_role)'),
 ('public.is_approved(uuid)'),
 ('public.on_candidate_stage_change()'),
 ('public.on_interview_change()'),
 ('public.on_offer_change()'),
 ('public.on_submission_insert()'),
 ('public.resolve_candidate_uuid(text)'),
 ('public.resolve_client_uuid(text)'),
 ('public.resolve_job_uuid(text)'),
 ('public.rls_auto_enable()'),
 ('public.run_workflow_rules()'),
 ('public.set_assigned_recruiter()'),
 ('public.track_stage_changes()')
), expected_new_rpcs(signature) AS (VALUES
 ('public.crm_admin_manage_user(uuid,text,text)'),
 ('public.crm_update_own_profile(text,text,text)')
), tab AS (
 SELECT e.name,c.oid,c.relrowsecurity,
  c.relkind
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
  AND c.relname=e.name AND c.relkind IN ('r','p')
), app_table_rights AS (
 SELECT t.name,roles.principal,perm.privilege,
  CASE WHEN t.oid IS NULL THEN false ELSE
  pg_catalog.has_table_privilege(roles.principal,t.oid,perm.privilege)
  END AS allowed
 FROM tab t
 CROSS JOIN (VALUES ('anon'),('authenticated')) roles(principal)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) perm(privilege)
), col_rights AS (
 SELECT t.name,a.attname,roles.principal,perm.privilege,
  pg_catalog.has_column_privilege(roles.principal,t.oid,a.attnum,perm.privilege) AS allowed
 FROM tab t
 JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid
  AND a.attnum>0 AND NOT a.attisdropped
 CROSS JOIN (VALUES('anon'),('authenticated')) roles(principal)
 CROSS JOIN (VALUES('SELECT'),('UPDATE')) perm(privilege)
), vw AS (
 SELECT e.name,c.oid,
 COALESCE(c.reloptions @> ARRAY['security_invoker=true']::text[],false) AS invoker,
 CASE WHEN c.oid IS NULL THEN false ELSE
  pg_catalog.has_table_privilege('anon',c.oid,'SELECT') END AS anon_select
 FROM expected_views e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 AND c.relname=e.name AND c.relkind='v'
), fn AS (
 SELECT e.signature,p.oid,p.prosecdef,
 CASE WHEN p.oid IS NULL THEN false ELSE
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END AS anon_exec,
 CASE WHEN p.oid IS NULL THEN false ELSE
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END AS auth_exec,
 CASE WHEN p.oid IS NULL THEN false ELSE
  pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') END AS service_exec,
 CASE WHEN p.oid IS NULL THEN false ELSE EXISTS (
 SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,
  pg_catalog.acldefault('f',p.proowner))) acl
 WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') END AS public_exec
 FROM expected_functions e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(e.signature)
), new_rpc AS (
 SELECT e.signature,p.oid,p.prosecdef,
 CASE WHEN p.oid IS NULL THEN false ELSE
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END AS anon_exec,
 CASE WHEN p.oid IS NULL THEN false ELSE
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END AS auth_exec,
 CASE WHEN p.oid IS NULL THEN false ELSE EXISTS (
 SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,
  pg_catalog.acldefault('f',p.proowner))) acl
 WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') END AS public_exec
 FROM expected_new_rpcs e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(e.signature)
), aggregate AS (
 SELECT
 (SELECT count(*) FROM tab WHERE oid IS NOT NULL) AS tables_present,
 (SELECT count(*) FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS actual_public_tables,
 (SELECT count(*) FROM tab WHERE relrowsecurity) AS tables_rls_enabled,
 -- Authenticated still needs legitimate, independently verified RLS reads/writes.
 (SELECT count(*) FROM app_table_rights
  WHERE principal='authenticated' AND allowed
  AND privilege IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))
   AS authenticated_high_risk_table_grants,
 -- Pure table SELECT on app_settings could make all columns readable.
 (SELECT count(*) FROM app_table_rights
  WHERE principal='anon' AND allowed) AS anon_table_grants,
 (SELECT count(*) FROM col_rights WHERE principal='anon' AND allowed
  AND privilege='SELECT'
  AND NOT(name='app_settings' AND attname IN
  ('id','logo_url','default_color_theme'))) AS anon_unapproved_column_select,
 (SELECT count(*) FROM col_rights WHERE principal='anon' AND allowed
  AND privilege='UPDATE') AS anon_column_update,
 (SELECT count(*) FROM col_rights WHERE principal='anon' AND allowed
  AND privilege='SELECT' AND name='app_settings'
  AND attname IN ('id','logo_url','default_color_theme')) AS anon_branding_columns_select,
 (SELECT count(*) FROM app_table_rights WHERE principal='authenticated'
  AND allowed AND (
    (name='user_roles' AND privilege IN ('INSERT','UPDATE','DELETE'))
    OR (name='profiles' AND privilege='UPDATE')
   )) AS authenticated_direct_account_mutations,
 (SELECT count(*) FROM vw WHERE oid IS NOT NULL) AS views_present,
 (SELECT count(*) FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v') AS actual_public_views,
 (SELECT count(*) FROM vw WHERE invoker) AS invoker_views,
 (SELECT count(*) FROM vw WHERE anon_select) AS anon_selectable_views,
 (SELECT count(*) FROM fn WHERE oid IS NOT NULL AND prosecdef) AS privileged_functions_present,
 (SELECT count(*) FROM fn WHERE anon_exec) AS anon_executable_privileged_functions,
 (SELECT count(*) FROM fn WHERE public_exec) AS publicly_granted_privileged_functions,
 (SELECT count(*) FROM fn WHERE auth_exec) AS authenticated_executable_privileged_functions,
 (SELECT count(*) FROM fn WHERE service_exec) AS service_executable_privileged_functions,
 (SELECT count(*) FROM new_rpc WHERE oid IS NOT NULL AND prosecdef) AS reviewed_admin_rpcs_present,
 (SELECT count(*) FROM new_rpc WHERE auth_exec) AS auth_admin_rpcs_callable,
 (SELECT count(*) FROM new_rpc WHERE anon_exec OR public_exec) AS exposed_admin_rpcs,
 (SELECT count(*) FROM pg_catalog.pg_policies
  WHERE schemaname='public') AS all_public_policies,
 (SELECT count(DISTINCT tablename) FROM pg_catalog.pg_policies
  WHERE schemaname='public') AS public_policy_tables,
 (SELECT count(*) FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND permissive='PERMISSIVE'
  AND cmd='ALL' AND roles::text='{public}'
  AND btrim(COALESCE(qual,''))='true'
  AND btrim(COALESCE(with_check,''))='true') AS universal_public_all_policies
)
SELECT *,
 CASE WHEN
  tables_present=19 AND actual_public_tables=19 AND tables_rls_enabled=19
  AND authenticated_high_risk_table_grants=0
  AND anon_table_grants=0 AND anon_unapproved_column_select=0
  AND anon_column_update=0 AND anon_branding_columns_select=3
  AND authenticated_direct_account_mutations=0
  AND views_present=13 AND actual_public_views=13
  AND invoker_views=13 AND anon_selectable_views=0
  AND privileged_functions_present=16
  AND anon_executable_privileged_functions=0
  AND publicly_granted_privileged_functions=0
  AND authenticated_executable_privileged_functions=3
  AND service_executable_privileged_functions=16
  AND reviewed_admin_rpcs_present=2 AND auth_admin_rpcs_callable=2
  AND exposed_admin_rpcs=0
  AND all_public_policies=35 AND public_policy_tables=19
  AND universal_public_all_policies=0
 THEN 'REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE'
 ELSE 'HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE'
 END AS reviewer_gate
FROM aggregate;
