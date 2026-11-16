-- Build198 SELECT-ONLY unapproved helper source-drift checker.
-- Exact production version-hashes as of 16 Nov 2026. MATCH only means the
-- two legacy helper body sources are unchanged; it is NOT security approval.
-- No business rows or helper RPC executions.
WITH fingerprint AS (
 SELECT
 (SELECT md5(pg_catalog.pg_get_functiondef(p.oid))
  FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure('public.get_user_role(uuid)')) AS get_role_md5,
 (SELECT md5(pg_catalog.pg_get_functiondef(p.oid))
  FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure('public.is_approved(uuid)')) AS approval_md5
)
SELECT get_role_md5,approval_md5,
 CASE WHEN get_role_md5='83d72d3932a91c90ffa33f431063a831'
       AND approval_md5='b001be894ffd87ad17165cf28adea82e'
 THEN 'REVIEW_ONLY_LEGACY_FUNCTION_SOURCE_MATCH_NO_RELEASE'
 ELSE 'HOLD_LOOKUP_HELPER_DEFINITION_DRIFT'
 END AS source_review_gate
FROM fingerprint;
