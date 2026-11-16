-- BUILD57 / READ-ONLY LIVE FINANCIAL ACL FINGERPRINT.
-- SELECT-only: no financial records, customer PII or mutation.
-- This indicates a known unsafe legacy *grant surface*, not confirmed
-- successful anonymous writes (RLS may independently deny access).
WITH roles AS (
 SELECT rolname,rolbypassrls,
  has_table_privilege(oid,'public.billing','INSERT') AS bi,
  has_table_privilege(oid,'public.billing','UPDATE') AS bu,
  has_table_privilege(oid,'public.billing','DELETE') AS bd,
  has_table_privilege(oid,'public.billing','TRUNCATE') AS bt,
  has_table_privilege(oid,'public.offers','INSERT') AS oi,
  has_table_privilege(oid,'public.offers','UPDATE') AS ou,
  has_table_privilege(oid,'public.offers','DELETE') AS od
 FROM pg_roles
 WHERE rolname IN ('anon','authenticated','service_role')
), observed AS (
 SELECT count(*) AS api_roles,
  count(*) FILTER(WHERE bi AND bu AND bd AND bt) AS billing_all_write_roles,
  count(*) FILTER(WHERE oi AND ou AND od) AS offers_dml_roles,
  bool_or(rolname='service_role' AND rolbypassrls) AS service_role_bypassrls,
  md5(string_agg(rolname||':'||bi||':'||bu||':'||bd||':'||bt||':'||
     oi||':'||ou||':'||od||':'||rolbypassrls,E'\n' ORDER BY rolname)) AS grant_digest
 FROM roles
)
SELECT *,
 CASE WHEN api_roles=3 AND billing_all_write_roles=3
   AND offers_dml_roles=3 AND service_role_bypassrls=true
   AND grant_digest='6e19f3552ee067cf31763535f0076540'
 THEN 'LEGACY_GRANT_SURFACE_MATCH_REVIEW_ONLY'
 ELSE 'DRIFT_BLOCK_RELEASE' END AS status
FROM observed;
