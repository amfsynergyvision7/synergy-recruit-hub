// Disposable Postgres proposal compilation + authorization smoke test.
// This intentionally executes the REVIEW-ONLY draft in a synthetic database,
// NEVER on Supabase/production. Generic table stubs check SQL compatibility,
// not complete production schema or business workflows.
import {readFileSync,writeFileSync} from 'node:fs';
const sql=readFileSync(new URL('./full-rls-replacement-review-only.sql',import.meta.url),'utf8');
const tables=['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles'];
const fixture=`\\set ON_ERROR_STOP on
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
 SELECT NULLIF(current_setting('build2.uid',true),'')::uuid
$fn$;
CREATE FUNCTION public.is_approved(uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT $1='11111111-1111-1111-1111-111111111111'::uuid
$fn$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT ($1='11111111-1111-1111-1111-111111111111'::uuid AND $2='recruiter')
 OR ($1='22222222-2222-2222-2222-222222222222'::uuid AND $2='finance')
$fn$;
`+tables.map(t=>`CREATE TABLE public.${t} (
 id uuid PRIMARY KEY,user_id uuid,assigned_recruiter uuid,
 candidate_uuid uuid,candidate_id uuid,created_by uuid
);
ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.${t} TO authenticated,anon;
CREATE POLICY deliberately_insecure ON public.${t} FOR ALL USING (true) WITH CHECK (true);
`).join('\n');
const checks=`
-- Policy cleanup must remove permissive true policies on all 15 tables.
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
 AND policyname='deliberately_insecure';
 IF n<>0 THEN RAISE EXCEPTION 'permissive legacy policies survived: %',n; END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
 AND tablename IN (${tables.map(t=>"'"+t+"'").join(',')});
 IF n<25 THEN RAISE EXCEPTION 'expected replacement policies, got %',n; END IF;
END $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[${tables.map(t=>"'"+t+"'").join(',')}] LOOP
 IF has_table_privilege('anon','public.'||t,'SELECT')
 THEN RAISE EXCEPTION 'anon still has SELECT on %',t; END IF;
 END LOOP;
END $$;
INSERT INTO public.candidates(id,assigned_recruiter) VALUES
 ('00000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),
 ('00000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333');
SET ROLE authenticated;
SET build2.uid='11111111-1111-1111-1111-111111111111';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.candidates;
 IF n<>1 THEN RAISE EXCEPTION 'recruiter isolation failed: %',n; END IF;
END $$;
SET build2.uid='33333333-3333-3333-3333-333333333333';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.candidates;
 IF n<>0 THEN RAISE EXCEPTION 'unapproved identity exposed % candidates',n; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: actual 15-table review-only SQL compiles and passes synthetic cleanup/privilege/ownership checks' AS result;
`;
writeFileSync('/tmp/build2-policy-proposal-disposable.sql',fixture+'\n'+sql+'\n'+checks);
console.log('Generated disposable SQL policy proposal fixture for '+tables.length+' synthetic tables.');
