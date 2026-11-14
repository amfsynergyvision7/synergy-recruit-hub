-- BUILD56: SELECT-only live source fingerprint. Does NOT grant release.
WITH functions AS (
 SELECT p.proname,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND
   p.proname IN ('on_candidate_stage_change','on_offer_change')
), triggers AS (
 SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
 AND ((c.relname='candidates' AND t.tgname='trg_candidate_stage_change')
   OR (c.relname='offers' AND t.tgname='offers_stage_billing_trigger'))
 AND NOT t.tgisinternal
), observed AS (
 SELECT
 (SELECT count(*) FROM functions) AS n_functions,
 (SELECT md5(string_agg(proname||E'\x1f'||definition,E'\n' ORDER BY proname)) FROM functions) AS function_digest,
 (SELECT count(*) FROM triggers) AS n_triggers,
 (SELECT md5(string_agg(relname||E'\x1f'||tgname||E'\x1f'||definition,E'\n' ORDER BY relname,tgname)) FROM triggers) AS trigger_digest
)
SELECT *,
 CASE WHEN n_functions=2 AND function_digest='4185f4991651dfabc801b631939a7170'
  AND n_triggers=2 AND trigger_digest='05ca5a63bd7e8bc14544a25d0d8475a9'
 THEN 'MATCH_SOURCE_ONLY_NOT_APPROVAL' ELSE 'DRIFT_BLOCK_RELEASE' END AS status
FROM observed;
