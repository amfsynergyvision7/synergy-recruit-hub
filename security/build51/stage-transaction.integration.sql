-- Build51 disposable authorization fixture, ROLLBACK ONLY.
-- JWT-sub claim is SYNTHETIC: NOT real hosted Auth acceptance.
BEGIN;
SET LOCAL statement_timeout='35s';
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.candidate_stage AS ENUM(
 'lead_received','contacted','interested','resume_collected',
 'submitted_to_client','interview_scheduled','interview_completed',
 'selected','offer_released','joined','rejected','dropped'
);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.candidates(id uuid PRIMARY KEY,assigned_recruiter uuid,
 stage public.candidate_stage,notes text,updated_at timestamptz DEFAULT now());
CREATE TABLE public.audit_logs(user_id uuid,action text,table_name text,
 record_id text,details jsonb);
CREATE TABLE public.billing(candidate_id uuid,created_at timestamptz DEFAULT now());

-- Reproduce the dangerous live joined-stage billing branch as a real trigger.
CREATE FUNCTION public.build51_legacy_bill() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.stage IS DISTINCT FROM NEW.stage AND NEW.stage='joined' THEN
   INSERT INTO public.billing(candidate_id) VALUES(NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER build51_legacy_bill AFTER UPDATE OF stage ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.build51_legacy_bill();
CREATE FUNCTION public.build51_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('build51.fail_audit',true)='on' THEN
   RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE='P9012';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER build51_fail_audit BEFORE INSERT ON public.audit_logs
 FOR EACH ROW EXECUTE FUNCTION public.build51_fail_audit();

-- Mimic Build48 proposed narrow column DML grant before Build51 correction.
GRANT SELECT ON public.candidates TO authenticated;
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
\ir candidate-stage-rpc-review-only.sql

INSERT INTO public.profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','approved',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending',false),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','suspended',false);
INSERT INTO public.user_roles VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','recruiter'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','recruiter'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','recruiter'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','admin');
INSERT INTO public.candidates(id,assigned_recruiter,stage) VALUES
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','lead_received'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','lead_received'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','joined');

DO $checkgrants$ BEGIN
 IF has_column_privilege('authenticated','public.candidates','stage','UPDATE')
 OR NOT has_column_privilege('authenticated','public.candidates','notes','UPDATE')
 OR has_function_privilege('anon','public.crm_change_candidate_stage(uuid,text,text)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_change_candidate_stage(uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_change_candidate_stage(uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Incorrect stage grant or EXECUTE scope'; END IF;
END $checkgrants$;

SET ROLE authenticated;
DO $cases$
DECLARE stage_now text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
   UPDATE public.candidates SET stage='joined' WHERE id='11111111-1111-4111-8111-111111111111';
   RAISE EXCEPTION 'Direct stage DML was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','lead_received','contacted')<>'contacted'
 THEN RAISE EXCEPTION 'Authorized recruiter stage update failed'; END IF;
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','lead_received','interested');
  RAISE EXCEPTION 'Stale expected stage accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 BEGIN
  PERFORM public.crm_change_candidate_stage('22222222-2222-4222-8222-222222222222','lead_received','contacted');
  RAISE EXCEPTION 'Cross recruiter update accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','joined');
  RAISE EXCEPTION 'Joined stage auto billing bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','offer_released');
  RAISE EXCEPTION 'Offer side effect bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','interview_scheduled');
  RAISE EXCEPTION 'Interview side effect bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','interested');
  RAISE EXCEPTION 'Pending user could move stage';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','interested');
  RAISE EXCEPTION 'Suspended admin could move stage';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 BEGIN
  PERFORM public.crm_change_candidate_stage('33333333-3333-4333-8333-333333333333','joined','rejected');
  RAISE EXCEPTION 'Joined stage reverse allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Approved admin may edit any recruiter candidate, but not dangerous stages.
 IF public.crm_change_candidate_stage('22222222-2222-4222-8222-222222222222','lead_received','selected')<>'selected'
 THEN RAISE EXCEPTION 'Admin override denied'; END IF;
 PERFORM set_config('build51.fail_audit','on',true);
 BEGIN
  PERFORM public.crm_change_candidate_stage('22222222-2222-4222-8222-222222222222','selected','dropped');
  RAISE EXCEPTION 'Audit failure failed to roll back';
 EXCEPTION WHEN SQLSTATE 'P9012' THEN NULL; END;
 PERFORM set_config('build51.fail_audit','off',true);
 SELECT stage::text INTO stage_now FROM public.candidates
  WHERE id='22222222-2222-4222-8222-222222222222';
 IF stage_now<>'selected' THEN RAISE EXCEPTION 'Audit exception left partial stage change'; END IF;
END $cases$;
RESET ROLE;
-- Assert privileged audit and billing outcomes outside the unprivileged
-- authenticated role; do not grant recruiters access to either table.
DO $post$ DECLARE audit_count integer; BEGIN
 SELECT count(*) INTO audit_count FROM public.audit_logs;
 IF audit_count<>2 THEN RAISE EXCEPTION 'Expected two auditable successful transitions, got %',audit_count; END IF;
 IF EXISTS(SELECT 1 FROM public.billing)
 THEN RAISE EXCEPTION 'Legacy auto-billing fired during supposedly safe transitions'; END IF;
END $post$;
SET ROLE anon;
DO $anonymous$ BEGIN
 BEGIN
  PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111','contacted','interested');
  RAISE EXCEPTION 'Anonymous RPC execution was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anonymous$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS Build51 signed-subject simulation: stage ownership, grants, no billing, audit rollback, no persistent writes' AS outcome;
