-- Build89 nonproduction preseed: READ ONLY and source-pinned to Build75 historical values.
-- Historical production-source check matches 30/32 lab triggers because TWO lab
-- candidates trigger functions deliberately use a safer empty search_path; the
-- track_stage_changes lab function also qualifies public.candidate_stage_history.
-- This ALLOWLIST is NOT blanket acceptance of drift: both exact hardened function
-- MD5s must match, both trigger-definition hashes must match unchanged production,
-- and both are SECURITY DEFINER, disabled, private to anon/authenticated, with
-- search_path='' pinned. All other 30 production source hashes must remain exact.
-- This check does NOT overwrite the historical Build75 verifier. Neither check
-- inserts data or authorizes Auth Admin, UAT, production remediation or merge.
-- Re-run Build88 separate 19-table zero-fixture, forced-RLS, grants safety preflight
-- and require PASS immediately before any independently approved provisioning.
-- Origin Build75 verifier blob sha: 0e559d0265e39ff0e099ca1bbe0f784d7c685f7d

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
), expected_triggers(table_name,trigger_name,trigger_md5,function_md5) AS (VALUES
  ('app_settings','t_app_settings_u','9a04600f7d4a3142c2070444d3fdab06','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('billing','billing_invoice_number_trigger','4a2accd0af08e68cc2eee3ff7bca5346','c05e9fee1d19cc4216b70c17b25f6be0'),
  ('billing','billing_updated_at_trigger','b158e983fd438d437642ca765869189d','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('billing','normalize_billing_relationships_trigger','40d87485e3b5c90a021cd479e4130d9d','6b8868e4e576b839f817620230d9233b'),
  ('billing','workflow_rules_trigger','684e34796a3b3df43e0af7eda2070625','a935a8de320a15354a988ae5b980064a'),
  ('candidates','candidates_sync_defaults_trigger','06b4c3404841fce6d28f62ee50ec3093','e393543a1e26824770f57000f7c7b440'),
  ('candidates','candidates_updated_at_trigger','28387c4bdc82635cf845aeb8911bcbb3','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('candidates','set_assigned_recruiter_trigger','f0e8035858775f92d6d3077f11a02fe8','0b3f5aefd663dae047d866fddc805c96'),
  ('candidates','set_candidate_sync_defaults_trigger','badb8fbc46029f4132c534c2563003df','e393543a1e26824770f57000f7c7b440'),
  ('candidates','track_stage_changes_trigger','553468e85bd324fcd4f3153321dc1d70','1966ef60466b78a94bd0f700a8ae9468'),
  ('candidates','trg_candidate_stage_change','5600acd792f6b5cc319a8f082f4e73b3','dd20fc0b4ddf8f11d8a7788942321d12'),
  ('candidates','workflow_rules_trigger','d71773af2a4d444abd11fc0466631bab','a935a8de320a15354a988ae5b980064a'),
  ('clients','clients_updated_at_trigger','ac7bd81cd01a77e5ef99fb5c9601bdaa','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('clients','t_clients_u','425bf3c60b7f2aefff94f763fdf54bf4','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('clients','workflow_rules_trigger','6a1ea095ac63fcde47fc712bc654022a','a935a8de320a15354a988ae5b980064a'),
  ('google_integrations','set_google_integrations_updated_at','0ad2205c2fc406a5113231a579a1e4a9','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('google_integrations','sync_google_integration_mapping_trigger','078a3d7116665ed8708444326dfa0dba','657f79e6f4296b8ac38d61d26d896bdd'),
  ('integrations','integrations_updated_at','a387cb5105c1ec1864d5971b5ffc825e','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('interviews','interviews_stage_trigger','681b0d81ba23a07c6670d0d04fe18bce','d2d016a1a9689aeb57ce29124ebddf52'),
  ('interviews','normalize_interviews_relationships_trigger','edd141a128cc7cd713e1e8df35daa659','95167a9052d86ea03c0950637fa0493d'),
  ('interviews','workflow_rules_trigger','f90cd09980c74e634376c74ee9378fe1','a935a8de320a15354a988ae5b980064a'),
  ('job_openings','job_openings_updated_at_trigger','431b78f85459c3867fc600fd1521b29d','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('job_openings','normalize_job_openings_relationships_trigger','b972ec803bb490eab14afaaa74ef5281','2a14be58c05db0f0b980d71612a8abee'),
  ('offers','normalize_offers_relationships_trigger','d0f4e2d239443c329c4cbad3c114e128','ae3dda7fc72c8f7d54b24593a5210bed'),
  ('offers','offers_stage_billing_trigger','cc2e3a5d69a32975cbec4cd3db211829','d2c141f7d297ec7bdd96f70c1ad76079'),
  ('offers','offers_updated_at_trigger','a71f3c8806b3dafd6f4c547c5b6d0a3d','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('offers','workflow_rules_trigger','444a773a3d0461e49fdf1f93a2f593a3','a935a8de320a15354a988ae5b980064a'),
  ('profiles','t_profiles_u','0574e1037fa84bf203cb22afd301a427','e81033fd9e7d0e7ee6b87545c0f6fb2c'),
  ('submissions','normalize_submissions_relationships_trigger','b26d4f04764dc9ee30e8bbc3e467096e','7d3aa116d97d1540151d9670955360f9'),
  ('submissions','submissions_stage_trigger','9f7c163a6d3cc1a3ee35f7c9f175359d','4feb3b6d8daeba95e6cd282876209be6'),
  ('submissions','workflow_rules_trigger','87d31da5d1d4cfda253b255279f55680','a935a8de320a15354a988ae5b980064a'),
  ('workflow_rules','workflow_rules_set_updated_at','538f41d94f0b28a5a42c4b91ec94c88c','e81033fd9e7d0e7ee6b87545c0f6fb2c')
), table_state AS (
 SELECT e.name,c.oid,c.relrowsecurity,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'TRUNCATE') END AS anon_truncate,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'TRUNCATE') END AS auth_truncate
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind IN ('r','p')
), view_state AS (
 SELECT e.name,c.oid,
 CASE WHEN c.oid IS NULL THEN NULL ELSE coalesce(c.reloptions @> ARRAY['security_invoker=true']::text[],false) END AS security_invoker,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon',c.oid,'SELECT') END AS anon_select
 FROM expected_views e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind='v'
), app_triggers AS (
 SELECT c.relname table_name,t.tgname trigger_name,t.tgenabled enabled_mode,
 md5(pg_get_triggerdef(t.oid,true)) trigger_md5,
 md5(pg_get_functiondef(p.oid)) function_md5
 FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
 WHERE n.nspname='public' AND NOT t.tgisinternal
), known_triggers AS (
 SELECT a.table_name,a.trigger_name,a.enabled_mode,a.trigger_md5,a.function_md5
 FROM app_triggers a
 JOIN expected_triggers e ON e.table_name=a.table_name AND e.trigger_name=a.trigger_name
 AND e.trigger_md5=a.trigger_md5 AND e.function_md5=a.function_md5
), auth_users_hook AS (
 SELECT t.oid FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='auth' AND c.relname='users' AND NOT t.tgisinternal
), rollup AS (
 SELECT
 (SELECT count(*) FROM table_state WHERE oid IS NOT NULL) AS matched_tables,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS actual_public_tables,
 (SELECT count(*) FROM table_state WHERE oid IS NOT NULL AND relrowsecurity) AS rls_enabled_tables,
 (SELECT count(*) FROM table_state WHERE anon_truncate IS TRUE) AS anon_truncate_tables,
 (SELECT count(*) FROM table_state WHERE auth_truncate IS TRUE) AS authenticated_truncate_tables,
 (SELECT count(*) FROM view_state WHERE oid IS NOT NULL) AS matched_views,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS actual_public_views,
 (SELECT count(*) FROM view_state WHERE security_invoker IS TRUE) AS invoker_views,
 (SELECT count(*) FROM view_state WHERE anon_select IS TRUE) AS anon_readable_views,
 (SELECT count(*) FROM app_triggers) AS actual_app_triggers,
 (SELECT count(*) FROM known_triggers) AS approved_source_or_hardened_app_triggers,
 (SELECT count(*) FROM app_triggers WHERE enabled_mode<>'D') AS not_disabled_app_triggers,
 (SELECT count(*) FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='candidates'
      AND t.tgenabled='D' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND (
         (t.tgname='set_assigned_recruiter_trigger'
          AND md5(pg_get_functiondef(p.oid))='0b3f5aefd663dae047d866fddc805c96')
         OR
         (t.tgname='track_stage_changes_trigger'
          AND md5(pg_get_functiondef(p.oid))='1966ef60466b78a94bd0f700a8ae9468')
      )
   ) AS safe_hardened_function_variants,
 (SELECT count(*) FROM auth_users_hook) AS auth_user_hooks,
 (SELECT count(*) FROM auth.users) AS auth_user_count
)
SELECT *,
 CASE WHEN matched_tables=19 AND actual_public_tables=19 AND rls_enabled_tables=19
 AND anon_truncate_tables=0 AND authenticated_truncate_tables=0
 AND matched_views=13 AND actual_public_views=13 AND invoker_views=13 AND anon_readable_views=0
 AND actual_app_triggers=32 AND approved_source_or_hardened_app_triggers=32 AND safe_hardened_function_variants=2 AND not_disabled_app_triggers=0
 AND auth_user_hooks=0 AND auth_user_count=0
 THEN 'TECHNICAL_PRESEED_30_EXACT_PLUS_2_HARDENED_PASS_NOT_PROVISIONING_PERMISSION'
 ELSE 'HOLD_NONPROD_PRESEED_SCHEMA_TRIGGER_AUTH_OR_GRANTS'
 END AS seed_gate
FROM rollup;
