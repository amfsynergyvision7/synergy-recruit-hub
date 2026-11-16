-- Build63 COUNT-ONLY hosted UAT readiness snapshot (dedicated nonproduction project only).
-- No Auth identity fields, CRM records or secrets. Do not use for approval by itself.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public') AS public_table_count,
  (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public') AS public_policy_count,
  (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n
   ON n.oid=p.pronamespace WHERE n.nspname='public') AS public_function_count;
