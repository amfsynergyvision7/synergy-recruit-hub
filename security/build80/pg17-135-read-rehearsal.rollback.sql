-- Build80 REVIEW-ONLY, NON-DEPLOYABLE, TRANSACTION-ROLLED-BACK 135-read-case policy proposal.
-- NOT authorized for production, staging or current hosted nonproduction.
-- Does NOT run 5 write cases. Do not bypass Build79 execution-safety block.
-- All 19 source CRM tables must already have RLS + FORCE RLS and 32 triggers disabled.
-- PostgREST signed token enforcement, schema exposure, recovery and release signoffs
-- REQUIRE independent evidence outside this source file.
BEGIN;
-- Actual RLS semantics on synthetic subjects in a disposable PostgreSQL17 CI-only transaction.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance','operations','viewer');
CREATE TYPE public.user_status AS ENUM ('approved','pending','suspended','rejected');
GRANT USAGE ON TYPE public.app_role,public.user_status TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $b80_auth$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$b80_auth$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.audit_logs (id uuid primary key);
CREATE TABLE public.billing (id uuid primary key);
CREATE TABLE public.candidate_activities (id uuid primary key);
CREATE TABLE public.candidates (id uuid primary key, assigned_recruiter uuid);
CREATE TABLE public.clients (id uuid primary key);
CREATE TABLE public.google_integrations (id uuid primary key, user_id uuid);
CREATE TABLE public.integrations (id uuid primary key);
CREATE TABLE public.interviews (id uuid primary key, candidate_id uuid, candidate_uuid uuid);
CREATE TABLE public.job_openings (id uuid primary key, assigned_recruiter uuid);
CREATE TABLE public.notifications (id uuid primary key, user_id uuid);
CREATE TABLE public.offers (id uuid primary key);
CREATE TABLE public.profiles (id uuid primary key, status public.user_status not null, is_active boolean not null);
CREATE TABLE public.submissions (id uuid primary key, candidate_id uuid, candidate_uuid uuid);
CREATE TABLE public.sync_logs (id uuid primary key);
CREATE TABLE public.user_roles (id uuid primary key, user_id uuid not null, role public.app_role not null);
CREATE TABLE public.app_settings (id integer primary key);
CREATE TABLE public.candidate_stage_history (id uuid primary key);
CREATE TABLE public.email_log (id uuid primary key);
CREATE TABLE public.workflow_rules (id uuid primary key);
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000001-1111-4111-8111-000000000001','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000281','00000001-1111-4111-8111-000000000001','admin');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000002-1111-4111-8111-000000000002','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000282','00000002-1111-4111-8111-000000000002','recruiter');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000003-1111-4111-8111-000000000003','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000283','00000003-1111-4111-8111-000000000003','recruiter');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000004-1111-4111-8111-000000000004','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000284','00000004-1111-4111-8111-000000000004','finance');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000005-1111-4111-8111-000000000005','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000285','00000005-1111-4111-8111-000000000005','operations');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000006-1111-4111-8111-000000000006','pending',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000286','00000006-1111-4111-8111-000000000006','recruiter');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000007-1111-4111-8111-000000000007','approved',false);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000287','00000007-1111-4111-8111-000000000007','recruiter');
INSERT INTO public.profiles(id,status,is_active) VALUES ('00000008-1111-4111-8111-000000000008','approved',true);
INSERT INTO public.user_roles(id,user_id,role) VALUES ('40000000-0000-4000-8000-000000000288','00000008-1111-4111-8111-000000000008','viewer');
INSERT INTO public.audit_logs(id) VALUES ('40000000-0000-4000-8000-000000000001');
INSERT INTO public.billing(id) VALUES ('40000000-0000-4000-8000-000000000021');
INSERT INTO public.candidate_activities(id) VALUES ('40000000-0000-4000-8000-000000000041');
INSERT INTO public.candidates(id,assigned_recruiter) VALUES ('00000002-1111-4111-8111-000000000002','00000002-1111-4111-8111-000000000002');
INSERT INTO public.candidates(id,assigned_recruiter) VALUES ('00000003-1111-4111-8111-000000000003','00000003-1111-4111-8111-000000000003');
INSERT INTO public.clients(id) VALUES ('40000000-0000-4000-8000-000000000081');
INSERT INTO public.google_integrations(id,user_id) VALUES ('40000000-0000-4000-8000-000000000101','00000001-1111-4111-8111-000000000001');
INSERT INTO public.integrations(id) VALUES ('40000000-0000-4000-8000-000000000121');
INSERT INTO public.interviews(id,candidate_id,candidate_uuid) VALUES ('40000000-0000-4000-8000-000000000141','00000002-1111-4111-8111-000000000002','00000002-1111-4111-8111-000000000002');
INSERT INTO public.interviews(id,candidate_id,candidate_uuid) VALUES ('40000000-0000-4000-8000-000000000142','00000003-1111-4111-8111-000000000003','00000003-1111-4111-8111-000000000003');
INSERT INTO public.job_openings(id,assigned_recruiter) VALUES ('40000000-0000-4000-8000-000000000161','00000002-1111-4111-8111-000000000002');
INSERT INTO public.job_openings(id,assigned_recruiter) VALUES ('40000000-0000-4000-8000-000000000162','00000003-1111-4111-8111-000000000003');
INSERT INTO public.notifications(id,user_id) VALUES ('40000000-0000-4000-8000-000000000181','00000002-1111-4111-8111-000000000002');
INSERT INTO public.notifications(id,user_id) VALUES ('40000000-0000-4000-8000-000000000182','00000003-1111-4111-8111-000000000003');
INSERT INTO public.offers(id) VALUES ('40000000-0000-4000-8000-000000000201');
INSERT INTO public.submissions(id,candidate_id,candidate_uuid) VALUES ('40000000-0000-4000-8000-000000000241','00000002-1111-4111-8111-000000000002','00000002-1111-4111-8111-000000000002');
INSERT INTO public.submissions(id,candidate_id,candidate_uuid) VALUES ('40000000-0000-4000-8000-000000000242','00000003-1111-4111-8111-000000000003','00000003-1111-4111-8111-000000000003');
INSERT INTO public.sync_logs(id) VALUES ('40000000-0000-4000-8000-000000000261');
INSERT INTO public.app_settings(id) VALUES (1);
INSERT INTO public.candidate_stage_history(id) VALUES ('40000000-0000-4000-8000-000000000321');
INSERT INTO public.email_log(id) VALUES ('40000000-0000-4000-8000-000000000341');
INSERT INTO public.workflow_rules(id) VALUES ('40000000-0000-4000-8000-000000000361');
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stage_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_rules FORCE ROW LEVEL SECURITY;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='40s';
DO $build80_guard$ BEGIN
 IF (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace
      AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>19
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>0
    OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
         AND t.tgenabled<>'D')<>0
 THEN RAISE EXCEPTION 'Build80 requires isolated review-only RLS baseline'; END IF;
END $build80_guard$;

-- A deliberately non-API, small authenticated-only guard. No caller-supplied
-- target user ID: permissions derive exclusively from the signed subject
-- supplied by PostgREST/GoTrue. Never inspect user-editable user_metadata.
-- SECURITY DEFINER requires independent SECURITY REVIEW before any deployment.
-- One qualifying role per account; multi-role accounts fail closed.
CREATE SCHEMA amf_rls_guard;
REVOKE ALL ON SCHEMA amf_rls_guard FROM PUBLIC, anon, authenticated;
CREATE FUNCTION amf_rls_guard.current_has_role(wanted public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $build80_body$
DECLARE uid uuid;
DECLARE eligible boolean;
BEGIN
 uid:=auth.uid();
 IF uid IS NULL THEN RETURN false; END IF;
 SELECT coalesce(count(*)=1 AND bool_and(ur.role=wanted),false)
   INTO eligible
 FROM public.profiles p
 JOIN public.user_roles ur ON ur.user_id=p.id
 WHERE p.id=uid AND p.status='approved' AND p.is_active=true;
 RETURN coalesce(eligible,false);
END;
$build80_body$;
REVOKE ALL ON FUNCTION amf_rls_guard.current_has_role(public.app_role)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA amf_rls_guard TO authenticated;
GRANT EXECUTE ON FUNCTION amf_rls_guard.current_has_role(public.app_role)
 TO authenticated;

-- The current dedicated hosted lab has zero public policies, no anon grants.
-- All 15 exposed read-table grants are SELECT only. No DML/write privilege.
REVOKE ALL ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,
 public.integrations,public.interviews,public.job_openings,public.notifications,
 public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 FROM anon,authenticated;
GRANT SELECT ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,
 public.integrations,public.interviews,public.job_openings,public.notifications,
 public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 TO authenticated;

-- Account self-reads are allowed for pending/inactive users, but admin-wide
-- visibility requires approved+active unique admin membership.
CREATE POLICY b80_read_profiles ON public.profiles FOR SELECT TO authenticated
 USING (id=(select auth.uid()) OR amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_user_roles ON public.user_roles FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) OR amf_rls_guard.current_has_role('admin'));

-- Approved, active recruiter: their own candidate and job; never peers'.
CREATE POLICY b80_read_candidates ON public.candidates FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   assigned_recruiter=(select auth.uid())));
CREATE POLICY b80_read_job_openings ON public.job_openings FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   assigned_recruiter=(select auth.uid())));

-- Linked recruiter-owned candidate is required for submissions/interviews;
-- no trusting created_by or mutable metadata for authorization.
CREATE POLICY b80_read_submissions ON public.submissions FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id=coalesce(candidate_uuid,candidate_id)
      AND c.assigned_recruiter=(select auth.uid()))));
CREATE POLICY b80_read_interviews ON public.interviews FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id=coalesce(candidate_uuid,candidate_id)
      AND c.assigned_recruiter=(select auth.uid()))));
CREATE POLICY b80_read_notifications ON public.notifications FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
  (amf_rls_guard.current_has_role('recruiter') AND
   user_id=(select auth.uid())));

-- Restricted finance read is billing only. Nothing here issues invoices.
CREATE POLICY b80_read_billing ON public.billing FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') OR
        amf_rls_guard.current_has_role('finance'));

-- Sensitive internal activity, clients, offers, sync and integrations:
-- unique approved active admin only. A GoTrue account alone has no privileges.
CREATE POLICY b80_read_audit_logs ON public.audit_logs FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_candidate_activities ON public.candidate_activities FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_clients ON public.clients FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_integrations ON public.integrations FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_offers ON public.offers FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));
CREATE POLICY b80_read_sync_logs ON public.sync_logs FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin'));

-- Source's historical integration matrix expects one admin-owned row only.
CREATE POLICY b80_read_google_integrations ON public.google_integrations FOR SELECT TO authenticated
 USING (amf_rls_guard.current_has_role('admin') AND
        user_id=(select auth.uid()));

-- Four other application tables intentionally stay default-deny:
-- app_settings (branding decision is separate), candidate_stage_history,
-- email_log and workflow_rules. No anon, any-table DML, view grants or
-- financial activation is introduced.
DO $build80_post$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname='public' AND policyname LIKE 'b80_read_%'
    AND cmd='SELECT' AND roles::text='{authenticated}';
 IF n<>15 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>15
   THEN RAISE EXCEPTION 'Build80 expected exactly 15 authenticated SELECT policies'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND
   (cmd<>'SELECT' OR tablename IN ('app_settings','candidate_stage_history',
     'email_log','workflow_rules'))) THEN
   RAISE EXCEPTION 'Build80 attempted forbidden CRM policy surface'; END IF;
 IF has_table_privilege('anon','public.candidates','SELECT')
   OR has_table_privilege('anon','public.billing','SELECT')
   OR has_table_privilege('authenticated','public.candidates','INSERT')
   OR has_table_privilege('authenticated','public.billing','UPDATE')
   OR has_table_privilege('authenticated','public.offers','DELETE')
   OR has_function_privilege('anon','amf_rls_guard.current_has_role(public.app_role)','EXECUTE')
   THEN RAISE EXCEPTION 'Build80 proposed grant scope is unsafe'; END IF;
END $build80_post$;

-- Actual PostgreSQL 17 RLS as unprivileged authenticated role.
SET LOCAL ROLE authenticated;
DO $b80_real$
DECLARE c record; n integer; subject_id uuid; tested integer:=0; denied integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','',true);
 SELECT count(*) INTO n FROM public.profiles;
 IF n<>0 THEN RAISE EXCEPTION 'No signed subject must yield zero profile rows'; END IF;
 FOR c IN SELECT * FROM (VALUES
 (1,'audit_logs',1),
 (1,'billing',1),
 (1,'candidate_activities',1),
 (1,'candidates',2),
 (1,'clients',1),
 (1,'google_integrations',1),
 (1,'integrations',1),
 (1,'interviews',2),
 (1,'job_openings',2),
 (1,'notifications',2),
 (1,'offers',1),
 (1,'profiles',8),
 (1,'submissions',2),
 (1,'sync_logs',1),
 (1,'user_roles',8),
 (2,'audit_logs',0),
 (2,'billing',0),
 (2,'candidate_activities',0),
 (2,'candidates',1),
 (2,'clients',0),
 (2,'google_integrations',0),
 (2,'integrations',0),
 (2,'interviews',1),
 (2,'job_openings',1),
 (2,'notifications',1),
 (2,'offers',0),
 (2,'profiles',1),
 (2,'submissions',1),
 (2,'sync_logs',0),
 (2,'user_roles',1),
 (3,'audit_logs',0),
 (3,'billing',0),
 (3,'candidate_activities',0),
 (3,'candidates',1),
 (3,'clients',0),
 (3,'google_integrations',0),
 (3,'integrations',0),
 (3,'interviews',1),
 (3,'job_openings',1),
 (3,'notifications',1),
 (3,'offers',0),
 (3,'profiles',1),
 (3,'submissions',1),
 (3,'sync_logs',0),
 (3,'user_roles',1),
 (4,'audit_logs',0),
 (4,'billing',1),
 (4,'candidate_activities',0),
 (4,'candidates',0),
 (4,'clients',0),
 (4,'google_integrations',0),
 (4,'integrations',0),
 (4,'interviews',0),
 (4,'job_openings',0),
 (4,'notifications',0),
 (4,'offers',0),
 (4,'profiles',1),
 (4,'submissions',0),
 (4,'sync_logs',0),
 (4,'user_roles',1),
 (5,'audit_logs',0),
 (5,'billing',0),
 (5,'candidate_activities',0),
 (5,'candidates',0),
 (5,'clients',0),
 (5,'google_integrations',0),
 (5,'integrations',0),
 (5,'interviews',0),
 (5,'job_openings',0),
 (5,'notifications',0),
 (5,'offers',0),
 (5,'profiles',1),
 (5,'submissions',0),
 (5,'sync_logs',0),
 (5,'user_roles',1),
 (6,'audit_logs',0),
 (6,'billing',0),
 (6,'candidate_activities',0),
 (6,'candidates',0),
 (6,'clients',0),
 (6,'google_integrations',0),
 (6,'integrations',0),
 (6,'interviews',0),
 (6,'job_openings',0),
 (6,'notifications',0),
 (6,'offers',0),
 (6,'profiles',1),
 (6,'submissions',0),
 (6,'sync_logs',0),
 (6,'user_roles',1),
 (7,'audit_logs',0),
 (7,'billing',0),
 (7,'candidate_activities',0),
 (7,'candidates',0),
 (7,'clients',0),
 (7,'google_integrations',0),
 (7,'integrations',0),
 (7,'interviews',0),
 (7,'job_openings',0),
 (7,'notifications',0),
 (7,'offers',0),
 (7,'profiles',1),
 (7,'submissions',0),
 (7,'sync_logs',0),
 (7,'user_roles',1),
 (8,'audit_logs',0),
 (8,'billing',0),
 (8,'candidate_activities',0),
 (8,'candidates',0),
 (8,'clients',0),
 (8,'google_integrations',0),
 (8,'integrations',0),
 (8,'interviews',0),
 (8,'job_openings',0),
 (8,'notifications',0),
 (8,'offers',0),
 (8,'profiles',1),
 (8,'submissions',0),
 (8,'sync_logs',0),
 (8,'user_roles',1),
 (9,'audit_logs',0),
 (9,'billing',0),
 (9,'candidate_activities',0),
 (9,'candidates',0),
 (9,'clients',0),
 (9,'google_integrations',0),
 (9,'integrations',0),
 (9,'interviews',0),
 (9,'job_openings',0),
 (9,'notifications',0),
 (9,'offers',0),
 (9,'profiles',0),
 (9,'submissions',0),
 (9,'sync_logs',0),
 (9,'user_roles',0)
 ) AS matrix(slot,table_name,expected_count)
 LOOP
  subject_id:=format('0000000%s-1111-4111-8111-00000000000%s',c.slot,c.slot)::uuid;
  PERFORM set_config('request.jwt.claim.sub',subject_id::text,true);
  EXECUTE format('SELECT count(*) FROM public.%I',c.table_name) INTO n;
  IF n<>c.expected_count THEN
   RAISE EXCEPTION 'BUILD80 actual PostgreSQL RLS case % on % expected %, got %',
    tested+1,c.table_name,c.expected_count,n;
  END IF;
  tested:=tested+1;
 END LOOP;
 IF tested<>135 THEN RAISE EXCEPTION 'Incomplete historical 135-case replay'; END IF;
 FOR c IN SELECT unnest(ARRAY['app_settings','candidate_stage_history','email_log','workflow_rules']) AS table_name
 LOOP
  BEGIN
   EXECUTE format('SELECT count(*) FROM public.%I',c.table_name) INTO n;
   RAISE EXCEPTION 'Default-denied table unexpectedly readable: %',c.table_name;
  EXCEPTION WHEN insufficient_privilege THEN
   denied:=denied+1;
  END;
 END LOOP;
 IF denied<>4 THEN RAISE EXCEPTION 'Incomplete default-deny scope'; END IF;
 IF has_table_privilege(current_user,'public.candidates','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege(current_user,'public.billing','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege(current_user,'public.offers','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege(current_user,'public.profiles','INSERT,UPDATE,DELETE,TRUNCATE')
 THEN RAISE EXCEPTION 'Accidental signed-user write grant'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000002-1111-4111-8111-000000000002',true);
 IF EXISTS (SELECT 1 FROM public.candidates WHERE id='00000003-1111-4111-8111-000000000003'::uuid)
 THEN RAISE EXCEPTION 'Recruiter 2 reads another recruiter candidate'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id='00000002-1111-4111-8111-000000000002'::uuid)
 THEN RAISE EXCEPTION 'Recruiter 2 denied owned candidate'; END IF;
 RAISE NOTICE 'BUILD80 ACTUAL DISPOSABLE POSTGRES: 135/135 read counts, 4 default denies, no app write grant, cross-recruiter ownership PASS';
END $b80_real$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $b80_anon$
DECLARE n integer; blocked integer:=0; tab text;
BEGIN
 FOR tab IN SELECT unnest(ARRAY['profiles','candidates','billing',
  'user_roles','notifications','google_integrations'])
 LOOP
  BEGIN
   EXECUTE format('SELECT count(*) FROM public.%I',tab) INTO n;
   RAISE EXCEPTION 'Anonymous table read unexpectedly succeeded: %',tab;
  EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;
  END;
 END LOOP;
 IF blocked<>6 THEN RAISE EXCEPTION 'Expected six anonymous denials'; END IF;
 RAISE NOTICE 'BUILD80 DISPOSABLE POSTGRES: 6/6 anonymous SELECT grants denied';
END $b80_anon$;
RESET ROLE;
SELECT 'BUILD80_POSTGRES17_135_ACTUAL_RLS_READ_CASES_PASS_DISPOSABLE_ONLY' AS technical_result,
 0 AS hosted_signed_gotrue_cases,0 AS formal_uat_accepted;

ROLLBACK;
DO $check$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated'))
 OR EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r')
 OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','amf_rls_guard'))
 THEN RAISE EXCEPTION 'Build80 disposable lab did not rollback all roles/schema'; END IF;
END $check$;
SELECT 'BUILD80_POSTGRES17_ALL_SYNTHETIC_SCHEMA_AND_ROLES_ROLLED_BACK' AS isolation_result;
