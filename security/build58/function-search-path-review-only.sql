-- Build58 source-exact security fix, REVIEW ONLY.
DO $b58_before$
DECLARE n int; h text; vulnerable int; definers int;
BEGIN
 SELECT count(*),
 md5(string_agg(p.proname||E'\x1f'||pg_get_function_identity_arguments(p.oid)
 ||E'\x1f'||p.prosecdef||E'\x1f'||coalesce(p.proconfig::text,'<NULL>')
 ||E'\x1f'||pg_get_functiondef(p.oid),E'\n'
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))),
 count(*) FILTER(WHERE p.proconfig IS NULL),count(*) FILTER(WHERE p.prosecdef)
 INTO n,h,vulnerable,definers
 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes');
 IF n<>4 OR definers<>2 OR NOT (
  (h='ea5005b2208a2d0891e3f8004fd7de80' AND vulnerable=4)
   OR (h='f0e40a79b530175737b188ab4bb479d2' AND vulnerable=2)
 ) THEN
  RAISE EXCEPTION 'Build58 exact live function source drift: n %, digest %, mutable %, definers %',n,h,vulnerable,definers
   USING ERRCODE='42501';
 END IF;
END $b58_before$;

ALTER FUNCTION public.get_recruiter_stats(date,date) SET search_path=pg_catalog,public;
ALTER FUNCTION public.search_candidates(text) SET search_path=pg_catalog,public;
ALTER FUNCTION public.set_assigned_recruiter() SET search_path=pg_catalog,public;
ALTER FUNCTION public.track_stage_changes() SET search_path=pg_catalog,public;

REVOKE ALL ON FUNCTION public.get_recruiter_stats(date,date),
 public.search_candidates(text),public.set_assigned_recruiter(),
 public.track_stage_changes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_recruiter_stats(date,date),
 public.search_candidates(text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_assigned_recruiter(),
 public.track_stage_changes() FROM authenticated,service_role;

DO $b58_after$
DECLARE n int; f record;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes')
 AND p.proconfig @> ARRAY['search_path=pg_catalog, public']::text[];
 IF n<>4 THEN RAISE EXCEPTION 'Build58 not all function search paths fixed'; END IF;
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes')
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous function execution remains';
  END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.set_assigned_recruiter()','EXECUTE')
 OR has_function_privilege('authenticated','public.track_stage_changes()','EXECUTE') THEN
  RAISE EXCEPTION 'Trigger functions still web callable';
 END IF;
 IF NOT has_function_privilege('authenticated','public.search_candidates(text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.get_recruiter_stats(date,date)','EXECUTE') THEN
  RAISE EXCEPTION 'Signed-in read RPCs lost';
 END IF;
END $b58_after$;
