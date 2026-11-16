-- Build159 READ-ONLY pg_catalog security preflight. NO DATA ROW READS.
-- This is advisory evidence, not permission to enable email or run migrations.
WITH proposed AS (
 SELECT p.oid, p.proname, p.pronargs, p.prosecdef,
  p.proconfig, pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
  pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
  AND p.proname IN ('crm_email_reserve_trusted','crm_email_settle_trusted')
), verdict AS (
 SELECT count(*) AS matching_named_procedures,
  count(*) FILTER (
   WHERE proname='crm_email_reserve_trusted' AND pronargs=7
   AND NOT prosecdef AND service_exec
   AND NOT anon_exec AND NOT authenticated_exec
   AND array_position(proconfig,'search_path=') IS NOT NULL
  ) AS safe_reservation_functions,
  count(*) FILTER (
   WHERE proname='crm_email_settle_trusted' AND pronargs=4
   AND NOT prosecdef AND service_exec
   AND NOT anon_exec AND NOT authenticated_exec
   AND array_position(proconfig,'search_path=') IS NOT NULL
  ) AS safe_settlement_functions,
  count(*) FILTER (WHERE anon_exec OR authenticated_exec OR prosecdef) AS unsafe_exposed_functions
 FROM proposed
)
SELECT matching_named_procedures,
 safe_reservation_functions,
 safe_settlement_functions,
 unsafe_exposed_functions,
 CASE
 WHEN matching_named_procedures=2
   AND safe_reservation_functions=1
   AND safe_settlement_functions=1
   AND unsafe_exposed_functions=0
 THEN 'REVIEW_ONLY_TRUSTED_JOURNAL_RPC_CATALOG_MATCH_NO_EMAIL_RELEASE'
 ELSE 'HOLD_TRUSTED_JOURNAL_RPCS_ABSENT_OR_UNSAFE'
 END AS trusted_journal_gate
FROM verdict;
