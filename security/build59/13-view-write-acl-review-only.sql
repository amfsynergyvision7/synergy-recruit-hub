-- BUILD59 VIEW PRIVILEGE REVIEW / INACTIVE. NOT a deployable migration.
-- PostgreSQL >=15. Must run AFTER Build49's security_invoker conversion.
-- Production source SQL 13-view digest (SELECT-only) 2026-11-12:
-- a90d4a1fab9552d47697127888e10d19
-- This does not prove current API writes succeed; RLS/base permissions also apply.
DO $b59_source_views$
DECLARE n integer; digest text; invokers integer; anonreads integer;
BEGIN
 SELECT count(*),
 md5(string_agg(c.relname||E'\x1f'||pg_get_viewdef(c.oid,true),
   E'\n' ORDER BY c.relname)),
 count(*) FILTER(WHERE 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]))),
 count(*) FILTER(WHERE has_table_privilege('anon',c.oid,'SELECT'))
 INTO n,digest,invokers,anonreads
 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='public' AND c.relkind='v'
  AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[]);
 IF n<>13 OR digest<>'a90d4a1fab9552d47697127888e10d19'
   OR invokers<>13 OR anonreads<>0 THEN
  RAISE EXCEPTION 'Build59 view source, invoker or anon READ drift: count %, md5 %, invoker %, anonread %',
   n,digest,invokers,anonreads USING ERRCODE='42501';
 END IF;
END $b59_source_views$;

-- Even an auto-updatable view must NOT be a bypass around the reviewed
-- candidate/billing RPCs and restricted base-table write permissions.
-- Drop every inherited/persisted API privilege, then restore SELECT only
-- for signed-in users and service integration clients.
DO $b59_views_dml_hold$
DECLARE v text; cols text;
BEGIN
 FOREACH v IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[] LOOP
  EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',v);
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum)
   INTO cols FROM pg_attribute a
   WHERE a.attrelid=format('public.%I',v)::regclass
    AND a.attnum>0 AND NOT a.attisdropped;
  IF cols IS NULL THEN RAISE EXCEPTION 'Build59 missing view columns: %',v; END IF;
  EXECUTE format('REVOKE INSERT(%s),UPDATE(%s),REFERENCES(%s) ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',
   cols,cols,cols,v);
  EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated,service_role',v);
 END LOOP;
END $b59_views_dml_hold$;

DO $b59_views_postflight$
DECLARE r record; v record; n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='public' AND c.relkind='v'
  AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
  AND 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]));
 IF n<>13 THEN RAISE EXCEPTION 'Build59 not all 13 views are invoker-safe'; END IF;
 FOR v IN SELECT c.oid,c.relname
  FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='public' AND c.relkind='v' AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
 LOOP
  IF has_table_privilege('anon',v.oid,'SELECT') OR
     NOT has_table_privilege('authenticated',v.oid,'SELECT') OR
     NOT has_table_privilege('service_role',v.oid,'SELECT')
  THEN RAISE EXCEPTION 'Build59 view SELECT grant mismatch on %',v.relname; END IF;
  FOR r IN SELECT rolname,oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
   IF has_table_privilege(r.oid,v.oid,'INSERT') OR
      has_table_privilege(r.oid,v.oid,'UPDATE') OR
      has_table_privilege(r.oid,v.oid,'DELETE') OR
      has_any_column_privilege(r.oid,v.oid,'INSERT') OR
      has_any_column_privilege(r.oid,v.oid,'UPDATE') OR
      has_any_column_privilege(r.oid,v.oid,'REFERENCES')
   THEN RAISE EXCEPTION 'Build59 unexpected API DML on view % role %',v.relname,r.rolname; END IF;
  END LOOP;
 END LOOP;
END $b59_views_postflight$;
