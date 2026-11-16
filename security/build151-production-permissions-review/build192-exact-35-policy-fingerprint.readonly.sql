-- BUILD192 READ ONLY: actual PostgreSQL-normalized proposed 35 RLS policy
-- fingerprint, obtained from exact source-pinned draft in isolated PG17.
-- This is NOT an approval of policy semantics, hosted compatibility or release.
-- No sensitive data rows, role assignment rows, candidate/client rows or RPCs.
WITH policies AS (
 SELECT tablename,policyname,permissive,roles::text AS role_text,
        cmd,qual,with_check
 FROM pg_catalog.pg_policies WHERE schemaname='public'
), fingerprint AS (
 SELECT count(*)::integer AS actual_policy_count,
 count(DISTINCT tablename)::integer AS actual_policy_tables,
 md5(string_agg(
 tablename||chr(31)||policyname||chr(31)||permissive||
 chr(31)||role_text||chr(31)||cmd||
 chr(31)||coalesce(qual,'<NULL>')||
 chr(31)||coalesce(with_check,'<NULL>'),
 chr(10) ORDER BY tablename,policyname)) AS actual_policy_md5
 FROM policies
)
SELECT actual_policy_count,actual_policy_tables,actual_policy_md5,
 '632d447f4cb5b5a88777e48916e288f9'::text AS proposed_source_policy_md5,
 CASE WHEN actual_policy_count=35 AND actual_policy_tables=19
 AND actual_policy_md5='632d447f4cb5b5a88777e48916e288f9'
 THEN 'REVIEW_ONLY_EXACT_35_POLICY_SOURCE_MATCH_NOT_RELEASE'
 ELSE 'HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT'
 END AS proposed_policy_source_gate
FROM fingerprint;
