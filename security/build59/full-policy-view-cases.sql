-- Build59 review-only full original 67->35 policy+view+finance test.
-- All actions below must run before the outer ROLLBACK.
RESET ROLE;
DO $b59_full_views$
DECLARE v text; n integer; a oid; role_name name;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='public' AND c.relkind='v' AND
 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]));
 IF n<>13 THEN RAISE EXCEPTION 'Build59 full policy view count %',n; END IF;
 FOREACH v IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[] LOOP
  a:=format('public.%I',v)::regclass;
  IF has_table_privilege('anon',a,'SELECT') THEN
   RAISE EXCEPTION 'Anonymous still reads protected view %',v; END IF;
  FOR role_name IN SELECT rolname FROM pg_roles
   WHERE rolname IN ('anon','authenticated','service_role') LOOP
   IF has_table_privilege(role_name,a,'INSERT')
    OR has_table_privilege(role_name,a,'UPDATE')
    OR has_table_privilege(role_name,a,'DELETE')
    OR has_any_column_privilege(role_name,a,'UPDATE') THEN
    RAISE EXCEPTION 'View write privilege remains % / %',v,role_name;
   END IF;
  END LOOP;
 END LOOP;
END $b59_full_views$;
SET ROLE anon;
DO $b59_anon_view$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.vw_candidate_filters;
  RAISE EXCEPTION 'Anon direct candidate view unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM count(*) FROM public.vw_billing_filters;
  RAISE EXCEPTION 'Anon direct billing view unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b59_anon_view$;
RESET ROLE;
SET ROLE authenticated;
DO $b59_recruiter_view$
DECLARE n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 SELECT count(*) INTO n FROM public.vw_candidate_filters;
 IF n<>1 THEN RAISE EXCEPTION 'Own candidate view visibility broke, expected 1 got %',n; END IF;
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 SELECT count(*) INTO n FROM public.vw_candidate_filters;
 IF n<>0 THEN RAISE EXCEPTION 'Inactive recruiter can see candidates through view'; END IF;
END $b59_recruiter_view$;
RESET ROLE;
