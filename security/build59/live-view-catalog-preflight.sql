-- BUILD59 SELECT-ONLY LIVE 13 VIEW catalog. No record reads or DDL.
WITH v AS (
 SELECT c.relname AS view_name,pg_get_viewdef(c.oid,true) AS definition,
 pg_get_userbyid(c.relowner) AS owner,
 coalesce('security_invoker=true'=ANY(c.reloptions),false) AS invoker,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS auth_update
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='v' AND
 c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
), observed AS(
 SELECT count(*) AS view_count,
 md5(string_agg(view_name||E'\x1f'||definition,E'\n' ORDER BY view_name)) AS view_sql_digest,
 count(*) FILTER(WHERE anon_select) AS anon_read_views,
 count(*) FILTER(WHERE auth_select) AS signed_read_views,
 count(*) FILTER(WHERE auth_update) AS signed_update_grant_views,
 count(*) FILTER(WHERE invoker) AS invoker_count
 FROM v
)
SELECT *, CASE
 WHEN view_count=13 AND view_sql_digest='a90d4a1fab9552d47697127888e10d19'
  AND anon_read_views=13 AND signed_read_views=13
  AND signed_update_grant_views=13 AND invoker_count=0
 THEN 'EXACT_LIVE_LEGACY_VIEW_SURFACE_REVIEW_ONLY'
 ELSE 'DRIFT_BLOCK_RELEASE' END AS status
FROM observed;
