// Disposable PostgreSQL ONLY. Batch-check actual 19-table/13-view grants SQL
// and additional three-table policy SQL, never run these proposals on production.
import {readFileSync,writeFileSync} from 'node:fs';
const base=new URL('./',import.meta.url);
const grants=readFileSync(new URL('19-table-13-view-grants-review-only.sql',base),'utf8');
const extra=readFileSync(new URL('additional-three-tables-review-only.sql',base),'utf8');
const tables=['app_settings','candidate_stage_history','email_log','workflow_rules'];
const views=['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters'];
const setup=tables.map(t=>`CREATE TABLE public.${t} (id uuid PRIMARY KEY,user_id uuid,sent_by uuid);
ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.${t} TO anon,authenticated;
`).join('\n')+views.map(v=>`CREATE VIEW public.${v} AS SELECT id FROM public.candidates;
GRANT SELECT ON public.${v} TO anon,authenticated;
`).join('\n');
const checks=`
DO $check$
DECLARE t text; v text; n integer;
BEGIN
 FOREACH t IN ARRAY ARRAY[${['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules'].map(x=>"'"+x+"'").join(',')}] LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT')
  THEN RAISE EXCEPTION 'anon SELECT leaked for table %',t; END IF;
 END LOOP;
 FOREACH v IN ARRAY ARRAY[${views.map(x=>"'"+x+"'").join(',')}] LOOP
  IF has_table_privilege('anon','public.'||v,'SELECT')
  THEN RAISE EXCEPTION 'anon SELECT leaked for view %',v; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname=v AND 'security_invoker=true'=ANY(c.reloptions))
  THEN RAISE EXCEPTION 'view % lacks security_invoker',v; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
 AND policyname IN ('app_settings_approved_read','app_settings_approved_admin_update',
 'email_log_scoped_read','email_log_approved_insert','workflow_rules_approved_admin');
 IF n<>5 THEN RAISE EXCEPTION 'expected 5 additional policies, got %',n; END IF;
END $check$;
SELECT 'PASS: actual 19-table/13-view grant SQL and 3-table policy SQL pass disposable metadata checks' AS result;
`;
writeFileSync('/tmp/build2-extra-proposals-disposable.sql',setup+'\n'+grants+'\n'+extra+'\n'+checks);
console.log('Prepared 19-table/13-view and three-table review-only SQL on disposable fixture.');
