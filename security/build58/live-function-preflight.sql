-- READ-ONLY production fingerprint, NOT release authorization.
WITH f AS(
 SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef,
 p.proconfig,pg_get_functiondef(p.oid) AS ddl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('set_assigned_recruiter','track_stage_changes','get_recruiter_stats','search_candidates'))
SELECT count(*) AS functions,
 md5(string_agg(proname||E'\x1f'||args||E'\x1f'||prosecdef||E'\x1f'||
 coalesce(proconfig::text,'<NULL>')||E'\x1f'||ddl,E'\n' ORDER BY proname,args)) AS fingerprint,
 count(*) FILTER(WHERE prosecdef) AS definers,
 count(*) FILTER(WHERE proconfig IS NULL) AS mutable,
 CASE WHEN count(*)=4 AND md5(string_agg(proname||E'\x1f'||args||E'\x1f'||prosecdef||E'\x1f'||
 coalesce(proconfig::text,'<NULL>')||E'\x1f'||ddl,E'\n' ORDER BY proname,args))
 ='ea5005b2208a2d0891e3f8004fd7de80' THEN 'MATCH_SOURCE_ONLY_NOT_APPROVAL' ELSE 'DRIFT_BLOCK_RELEASE' END AS status
FROM f;
