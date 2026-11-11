-- BUILD52: Synthetic roles + production-shaped candidate DML, transaction ROLLBACK.
-- This is NOT a hosted GoTrue Auth acceptance test or active migration.
BEGIN;
SET LOCAL statement_timeout='35s';
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','interested','resume_collected',
 'submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TABLE public.profiles(id uuid PRIMARY KEY,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.audit_logs(user_id uuid,action text,table_name text,record_id text,details jsonb);
CREATE TABLE public.candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_code text, full_name text NOT NULL, mobile text,email text,
 location text,position_applied text,current_company text,
 experience_years numeric,current_salary numeric,expected_salary numeric,
 notice_period text,resume_url text,source text,assigned_recruiter uuid,
 stage public.candidate_stage NOT NULL DEFAULT 'lead_received', notes text,
 created_by uuid, created_at timestamptz DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'active',created_source text,
 resume_summary text,ats_score int,ats_issues jsonb,ats_checked_at timestamptz
);
CREATE TABLE public.billing(candidate_id uuid);
CREATE TABLE public.workflow_rules(table_name text,is_active boolean);
-- Source-shaped legacy trigger overrides every UPDATE timestamp with now().
CREATE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $legacy52$
BEGIN NEW.updated_at:=now(); RETURN NEW; END $legacy52$;
CREATE TRIGGER candidates_updated_at_trigger BEFORE UPDATE ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE FUNCTION public.build52_bill() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 BEGIN IF NEW.stage='joined' AND OLD.stage IS DISTINCT FROM NEW.stage
  THEN INSERT INTO public.billing(candidate_id) VALUES(NEW.id); END IF;
  RETURN NEW; END $$;
CREATE TRIGGER bill_if_joined AFTER UPDATE OF stage ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.build52_bill();
CREATE FUNCTION public.build52_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF current_setting('build52.fail_audit',true)='on'
  THEN RAISE EXCEPTION 'Test audit failure' USING ERRCODE='P9012'; END IF;
  RETURN NEW; END $$;
CREATE TRIGGER fail_audit BEFORE INSERT ON public.audit_logs
 FOR EACH ROW EXECUTE FUNCTION public.build52_fail_audit();
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
INSERT INTO public.candidates(id,full_name,assigned_recruiter,stage) VALUES
 ('11111111-1111-4111-8111-111111111111','Owned A','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','lead_received'),
 ('22222222-2222-4222-8222-222222222222','Owned B','cccccccc-cccc-4ccc-8ccc-cccccccccccc','contacted');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.candidates TO authenticated;
-- Deliberately simulate older column grants that table REVOKE alone leaves.
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT INSERT(full_name) ON public.candidates TO authenticated;
\ir candidate-write-rpc-review-only.sql
DO $grantCheck$ BEGIN
 IF has_table_privilege('authenticated','public.candidates','INSERT')
 OR has_table_privilege('authenticated','public.candidates','UPDATE')
 OR has_table_privilege('authenticated','public.candidates','DELETE')
 OR has_column_privilege('authenticated','public.candidates','stage','UPDATE')
 OR has_function_privilege('anon','public.crm_write_candidate(uuid,timestamptz,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_write_candidate(uuid,timestamptz,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_write_candidate(uuid,timestamptz,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Unsafe direct candidate DML or function grants'; END IF;
END $grantCheck$;
-- Active workflow rules must fail closed even for an authorized actor.
INSERT INTO public.workflow_rules VALUES('candidates',true);
SET ROLE authenticated;
DO $wf_guard$ BEGIN
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Should never create"}'::jsonb);
  RAISE EXCEPTION 'Active privileged workflow rule did not block candidate creation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $wf_guard$;
RESET ROLE;
DELETE FROM public.workflow_rules;
SET ROLE authenticated;
DO $recruiter$
DECLARE n uuid; old_ts timestamptz; n_count integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  INSERT INTO public.candidates(full_name) VALUES('Browser bypass');
  RAISE EXCEPTION 'Direct candidate INSERT bypassed grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.candidates SET stage='joined';
  RAISE EXCEPTION 'Direct candidate UPDATE bypassed grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.candidates;
  RAISE EXCEPTION 'Direct candidate DELETE bypassed grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 n:=public.crm_write_candidate(NULL,NULL,'{"full_name":"Synthetic Recruiter Record","email":"test@example.invalid","notes":"Private candidate notes","experience_years":5}'::jsonb);
 IF n IS NULL THEN RAISE EXCEPTION 'Candidate creation returned NULL id'; END IF;
 SELECT count(*) INTO n_count FROM public.candidates WHERE id=n AND assigned_recruiter='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND stage='lead_received' AND created_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND status='active';
 IF n_count<>1 THEN RAISE EXCEPTION 'Created row ownership/stage/creator integrity missing'; END IF;
 SELECT updated_at INTO old_ts FROM public.candidates WHERE id=n;
 IF public.crm_write_candidate(n,old_ts,'{"notes":"Revised private note"}'::jsonb)<>n
 THEN RAISE EXCEPTION 'Owner edit failed'; END IF;
 IF (SELECT updated_at FROM public.candidates WHERE id=n)<=old_ts THEN
  RAISE EXCEPTION 'Legacy now() trigger defeated monotonic candidate version'; END IF;
 BEGIN
  PERFORM public.crm_write_candidate(n,old_ts,'{"notes":"Stale update"}'::jsonb);
  RAISE EXCEPTION 'Stale timestamp accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(n,clock_timestamp(),'{"stage":"joined"}'::jsonb);
  RAISE EXCEPTION 'Stage injected through detail RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Fake","created_by":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}'::jsonb);
  RAISE EXCEPTION 'Created_by spoofing allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Fake","assigned_recruiter":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}'::jsonb);
  RAISE EXCEPTION 'Recruiter reassignment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate('22222222-2222-4222-8222-222222222222',
     (SELECT updated_at FROM public.candidates WHERE id='22222222-2222-4222-8222-222222222222'),
     '{"notes":"Cross account"}'::jsonb);
  RAISE EXCEPTION 'Cross recruiter edit allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Fake","resume_url":"javascript:alert(1)"}'::jsonb);
  RAISE EXCEPTION 'Unsafe resume URL allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Fake","experience_years":-15}'::jsonb);
  RAISE EXCEPTION 'Negative experience allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Unapproved"}'::jsonb);
  RAISE EXCEPTION 'Pending recruiter created candidate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Suspended"}'::jsonb);
  RAISE EXCEPTION 'Suspended administrator created candidate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $recruiter$;
RESET ROLE;
-- Assert all write/audit behavior as owner; authenticated users should not
-- receive broad audit or billing-table read access.
DO $check$
DECLARE n integer; ts timestamptz; id_new uuid; before_details text;
BEGIN
 SELECT count(*) INTO n FROM public.audit_logs WHERE action IN('crm_candidate_create','crm_candidate_update');
 IF n<>2 THEN RAISE EXCEPTION 'Wrong number of successful audit events: %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE
    details::text ILIKE '%Private candidate notes%'
    OR details::text ILIKE '%Synthetic Recruiter Record%'
    OR details::text ILIKE '%test@example.invalid%')
 THEN RAISE EXCEPTION 'PII leaked into audit payload'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing) THEN RAISE EXCEPTION 'Legacy billing unexpectedly triggered'; END IF;
END $check$;
SET ROLE authenticated;
DO $admin$
DECLARE id_new uuid; ts timestamptz; n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 id_new:=public.crm_write_candidate(NULL,NULL,
 '{"full_name":"Admin-created","assigned_recruiter":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'::jsonb);
 SELECT updated_at INTO ts FROM public.candidates WHERE id=id_new;
 IF id_new IS NULL OR ts IS NULL THEN RAISE EXCEPTION 'Admin create failed'; END IF;
 IF public.crm_write_candidate(id_new,ts,
 '{"assigned_recruiter":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","location":"Kolkata"}'::jsonb)<>id_new
 THEN RAISE EXCEPTION 'Admin reassignment failed'; END IF;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,
    '{"full_name":"Invalid target","assigned_recruiter":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}'::jsonb);
  RAISE EXCEPTION 'Pending recruiter assignment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT updated_at INTO ts FROM public.candidates WHERE id=id_new;
 PERFORM set_config('build52.fail_audit','on',true);
 BEGIN
  PERFORM public.crm_write_candidate(id_new,ts,'{"notes":"Should rollback"}'::jsonb);
  RAISE EXCEPTION 'Injected audit failure ignored';
 EXCEPTION WHEN SQLSTATE 'P9012' THEN NULL; END;
 PERFORM set_config('build52.fail_audit','off',true);
END $admin$;
RESET ROLE;
DO $final$
DECLARE count_a int; n int;
BEGIN
 SELECT count(*) INTO count_a FROM public.audit_logs WHERE action IN('crm_candidate_create','crm_candidate_update');
 IF count_a<>4 THEN RAISE EXCEPTION 'Audit did not commit exactly 4 valid candidate events: %',count_a; END IF;
 IF EXISTS(SELECT 1 FROM public.candidates WHERE notes='Should rollback')
 THEN RAISE EXCEPTION 'Candidate mutated without committed audit'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing)
 THEN RAISE EXCEPTION 'Automatic financial billing triggered in ordinary candidate changes'; END IF;
END $final$;
SET ROLE anon;
DO $anonymous$ BEGIN
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Anonymous"}'::jsonb);
  RAISE EXCEPTION 'Anonymous RPC allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anonymous$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS Build52 candidate write RPC, audit rollback, ownership, frozen stage, legacy billing trap, no persistence' AS outcome;
