BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SET LOCAL statement_timeout='30s';
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','screening','interview','offer');
CREATE TABLE public.profiles(id uuid,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.google_integrations(id uuid PRIMARY KEY,user_id uuid,last_synced_row int,header_row int,spreadsheet_id text,sheet_name text,connection_status text,last_error text,last_sync timestamptz);
CREATE TABLE public.candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text NOT NULL,mobile text,email text,location text,position_applied text,current_company text,experience_years numeric,current_salary numeric,expected_salary numeric,notice_period text,resume_url text,source text,notes text,stage public.candidate_stage NOT NULL DEFAULT 'lead_received',status text NOT NULL DEFAULT 'active',created_source text,assigned_recruiter uuid);
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,message text,type text,related_table text,related_id uuid,CONSTRAINT notification_once UNIQUE(related_table,related_id,type));
CREATE SCHEMA crm_private;
CREATE TABLE crm_private.candidate_sync_leases(owner_id uuid PRIMARY KEY,lease_token uuid NOT NULL,expires_at timestamptz NOT NULL);
INSERT INTO public.profiles VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),('11111111-1111-4111-8111-111111111111','approved',true);
INSERT INTO public.user_roles VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('11111111-1111-4111-8111-111111111111','recruiter');
INSERT INTO public.google_integrations(id,user_id,last_synced_row,header_row,spreadsheet_id,sheet_name) VALUES ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',1,1,'TESTSHEET','Applicants');
INSERT INTO crm_private.candidate_sync_leases(owner_id,lease_token,expires_at) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',clock_timestamp()+interval '30 minutes');
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC,anon,authenticated;
CREATE TABLE crm_private.candidate_sync_row_ledger (
 integration_id uuid NOT NULL REFERENCES public.google_integrations(id),
 row_number integer NOT NULL CHECK (row_number>=2),
 source_key text NOT NULL,
 payload_fingerprint text NOT NULL,
 candidate_id uuid,
 action text NOT NULL CHECK (action IN ('created','updated','skipped')),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(integration_id,row_number)
);
ALTER TABLE crm_private.candidate_sync_row_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.candidate_sync_row_ledger FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.crm_commit_candidate_sync_row(
 p_owner uuid,p_token uuid,p_integration uuid,p_row_number integer,p_candidate jsonb,p_assigned_recruiter uuid
) RETURNS TABLE(outcome text,candidate_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_integration record;
 v_prior record;
 v_source text;
 v_fingerprint text;
 v_email text;
 v_mobile text;
 v_name text;
 v_id uuid;
 v_matched_count bigint;
 v_action text;
 v_previous_source text;
BEGIN
 IF p_owner IS NULL OR p_token IS NULL OR p_integration IS NULL OR p_row_number IS NULL
    OR p_row_number<2 OR p_candidate IS NULL OR jsonb_typeof(p_candidate)<>'object' THEN
   RAISE EXCEPTION 'Invalid sync row input' USING ERRCODE='22023';
 END IF;
 IF (p_candidate - ARRAY['full_name','mobile','email','location','position_applied',
 'current_company','experience_years','current_salary','expected_salary',
 'notice_period','resume_url','source','notes','stage','status','created_source']) <> '{}'::jsonb THEN
   RAISE EXCEPTION 'Unsupported candidate keys' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
   WHERE p.id=p_owner AND p.status='approved' AND p.is_active IS TRUE AND r.role='admin'
 ) THEN RAISE EXCEPTION 'Sync owner not an approved administrator' USING ERRCODE='42501'; END IF;
 IF p_assigned_recruiter IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
   WHERE p.id=p_assigned_recruiter AND p.status='approved'
     AND p.is_active IS TRUE AND r.role='recruiter'
 ) THEN RAISE EXCEPTION 'Approved active recruiter assignment required' USING ERRCODE='42501'; END IF;
 -- Lock makes a stale worker unable to commit after expiry/takeover.
 PERFORM 1 FROM crm_private.candidate_sync_leases l
 WHERE l.owner_id=p_owner AND l.lease_token=p_token AND l.expires_at>clock_timestamp()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired or not owned' USING ERRCODE='42501'; END IF;
 SELECT i.id,i.last_synced_row,i.header_row,i.spreadsheet_id,i.sheet_name,i.user_id
 INTO v_integration FROM public.google_integrations i
 WHERE i.id=p_integration AND i.user_id=p_owner FOR UPDATE;
 IF NOT FOUND OR v_integration.spreadsheet_id IS NULL OR v_integration.header_row IS NULL
 THEN RAISE EXCEPTION 'Integration owner or sheet missing' USING ERRCODE='42501'; END IF;
 IF p_row_number<=v_integration.header_row THEN
   RAISE EXCEPTION 'Header row cannot be imported' USING ERRCODE='22023';
 END IF;
 v_source:=v_integration.spreadsheet_id||':'||v_integration.sheet_name||':'||v_integration.header_row;
 v_fingerprint:=md5(p_candidate::text);
 SELECT l.source_key,l.payload_fingerprint,l.candidate_id,l.action INTO v_prior
 FROM crm_private.candidate_sync_row_ledger l
 WHERE l.integration_id=p_integration AND l.row_number=p_row_number;
 IF FOUND THEN
   IF v_prior.source_key<>v_source OR v_prior.payload_fingerprint<>v_fingerprint THEN
     RAISE EXCEPTION 'Existing imported row changed; manual review required' USING ERRCODE='23505';
   END IF;
   RETURN QUERY SELECT 'replayed'::text,v_prior.candidate_id;
   RETURN;
 END IF;
 IF v_integration.last_synced_row<>p_row_number-1 THEN
   RAISE EXCEPTION 'Non-contiguous cursor; manual review required' USING ERRCODE='23514';
 END IF;
 -- No silent takeover of old untracked cursors or a changed sheet source.
 IF v_integration.last_synced_row>v_integration.header_row THEN
   SELECT l.source_key INTO v_previous_source FROM crm_private.candidate_sync_row_ledger l
   WHERE l.integration_id=p_integration AND l.row_number=v_integration.last_synced_row;
   IF NOT FOUND OR v_previous_source<>v_source THEN
     RAISE EXCEPTION 'Prior sync cursor/source unverified; manual review required' USING ERRCODE='23514';
   END IF;
 END IF;
 -- Serialize cooperating importers across multiple owners; other manual writes
 -- are NOT protected, so unique-candidate/reconciliation review remains necessary.
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_candidate_sync_importers',0));
 v_email:=nullif(lower(btrim(p_candidate->>'email')),'');
 v_mobile:=nullif(btrim(p_candidate->>'mobile'),'');
 v_name:=coalesce(nullif(btrim(p_candidate->>'full_name'),''),v_email,v_mobile);
 IF length(coalesce(v_name,''))>512 OR length(coalesce(v_email,''))>320 OR length(coalesce(v_mobile,''))>64 THEN
   RAISE EXCEPTION 'Candidate identity too long' USING ERRCODE='22023';
 END IF;
 IF v_name IS NULL THEN
   v_action:='skipped';
   v_id:=NULL;
 ELSE
   SELECT count(*),min(c.id::text)::uuid INTO v_matched_count,v_id
   FROM public.candidates c
   WHERE (v_email IS NOT NULL AND lower(c.email)=v_email)
      OR (v_mobile IS NOT NULL AND c.mobile=v_mobile);
   IF v_matched_count>1 THEN
     RAISE EXCEPTION 'Ambiguous candidate identity; manual review required' USING ERRCODE='23505';
   END IF;
   IF v_id IS NULL THEN
     INSERT INTO public.candidates(
       full_name,mobile,email,location,position_applied,current_company,
       experience_years,current_salary,expected_salary,notice_period,resume_url,
       source,notes,stage,status,created_source,assigned_recruiter
     ) VALUES (
       v_name,v_mobile,v_email,nullif(p_candidate->>'location',''),
       nullif(p_candidate->>'position_applied',''),nullif(p_candidate->>'current_company',''),
       nullif(p_candidate->>'experience_years','')::numeric,
       nullif(p_candidate->>'current_salary','')::numeric,
       nullif(p_candidate->>'expected_salary','')::numeric,
       nullif(p_candidate->>'notice_period',''),nullif(p_candidate->>'resume_url',''),
       coalesce(nullif(p_candidate->>'source',''),'Google Form'),
       nullif(p_candidate->>'notes',''),'lead_received','active','google_form_sync',p_assigned_recruiter
     ) RETURNING id INTO v_id;
     INSERT INTO public.notifications(title,message,type,related_table,related_id)
     VALUES('New Candidate Added via Google Form','A candidate was synced from Google Sheets.',
            'success','candidates',v_id)
     ON CONFLICT DO NOTHING;
     v_action:='created';
   ELSE
     UPDATE public.candidates c SET
       full_name=v_name,
       email=coalesce(v_email,c.email),mobile=coalesce(v_mobile,c.mobile),
       location=coalesce(nullif(p_candidate->>'location',''),c.location),
       position_applied=coalesce(nullif(p_candidate->>'position_applied',''),c.position_applied),
       current_company=coalesce(nullif(p_candidate->>'current_company',''),c.current_company),
       experience_years=coalesce(nullif(p_candidate->>'experience_years','')::numeric,c.experience_years),
       current_salary=coalesce(nullif(p_candidate->>'current_salary','')::numeric,c.current_salary),
       expected_salary=coalesce(nullif(p_candidate->>'expected_salary','')::numeric,c.expected_salary),
       notice_period=coalesce(nullif(p_candidate->>'notice_period',''),c.notice_period),
       resume_url=coalesce(nullif(p_candidate->>'resume_url',''),c.resume_url),
       notes=coalesce(nullif(p_candidate->>'notes',''),c.notes)
     WHERE c.id=v_id;
     v_action:='updated';
   END IF;
 END IF;
 INSERT INTO crm_private.candidate_sync_row_ledger(
   integration_id,row_number,source_key,payload_fingerprint,candidate_id,action
 ) VALUES(p_integration,p_row_number,v_source,v_fingerprint,v_id,v_action);
 UPDATE public.google_integrations i
 SET last_synced_row=p_row_number,last_sync=clock_timestamp(),connection_status='success',last_error=NULL
 WHERE i.id=p_integration AND i.last_synced_row=p_row_number-1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync cursor update conflict' USING ERRCODE='40001'; END IF;
 -- Expiry that occurs while waiting on a database lock aborts the whole row.
 PERFORM 1 FROM crm_private.candidate_sync_leases l
 WHERE l.owner_id=p_owner AND l.lease_token=p_token AND l.expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired during row commit' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT v_action,v_id;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb,uuid)
 TO service_role;

CREATE FUNCTION public.fail_notification_if_flagged() RETURNS trigger LANGUAGE plpgsql AS $trap$ BEGIN IF current_setting('build43.fail_notification',true)='on' THEN RAISE EXCEPTION 'injected notification failure' USING ERRCODE='P9876'; END IF; RETURN NEW; END $trap$;
CREATE TRIGGER b43_notification_fail BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fail_notification_if_flagged();
DO $tests$ DECLARE r record; n int; BEGIN
 -- Assignment must resolve to an active, approved recruiter; neither admin
 -- ownership nor mere recruiter-role possession permits bypass.
 INSERT INTO public.profiles VALUES ('55555555-5555-4555-8555-555555555555','pending',true),
 ('66666666-6666-4666-8666-666666666666','approved',false);
 INSERT INTO public.user_roles VALUES ('55555555-5555-4555-8555-555555555555','recruiter'),
 ('66666666-6666-4666-8666-666666666666','recruiter');
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Rejected"}','55555555-5555-4555-8555-555555555555'); RAISE EXCEPTION 'pending recruiter accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Rejected"}','66666666-6666-4666-8666-666666666666'); RAISE EXCEPTION 'inactive recruiter accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Rejected"}',NULL::uuid); RAISE EXCEPTION 'missing recruiter accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 IF has_function_privilege('anon','public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute'; END IF;
 IF has_function_privilege('authenticated','public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'auth can execute'; END IF;
 IF NOT has_function_privilege('service_role','public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'service cannot execute'; END IF;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"No"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'recruiter succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',2,'{"full_name":"No"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'stale token succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Bad","assigned_recruiter":"11111111-1111-4111-8111-111111111111"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'unexpected candidate key accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('build43.fail_notification','on',true);
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Rollback","email":"rollback@example.invalid"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'notification error was not raised'; EXCEPTION WHEN SQLSTATE 'P9876' THEN NULL; END;
 PERFORM set_config('build43.fail_notification','off',true);
 SELECT count(*) INTO n FROM public.candidates; IF n<>0 THEN RAISE EXCEPTION 'postfailure candidate persisted'; END IF;
 SELECT count(*) INTO n FROM crm_private.candidate_sync_row_ledger; IF n<>0 THEN RAISE EXCEPTION 'postfailure ledger persisted'; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations WHERE id='44444444-4444-4444-8444-444444444444')<>1 THEN RAISE EXCEPTION 'postfailure cursor moved'; END IF;
 SELECT * INTO r FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"A","email":"alice@example.invalid","mobile":"111"}','11111111-1111-4111-8111-111111111111');
 IF r.outcome<>'created' OR r.candidate_id IS NULL THEN RAISE EXCEPTION 'initial creation invalid'; END IF;
 IF (SELECT assigned_recruiter FROM public.candidates WHERE id=r.candidate_id)<>'11111111-1111-4111-8111-111111111111' THEN RAISE EXCEPTION 'explicit approved recruiter not preserved'; END IF;
 SELECT * INTO r FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"mobile":"111","full_name":"A","email":"alice@example.invalid"}','11111111-1111-4111-8111-111111111111');
 IF r.outcome<>'replayed' THEN RAISE EXCEPTION 'idempotent replay failed'; END IF;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"mobile":"111","full_name":"Changed","email":"alice@example.invalid"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'modified row accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT * INTO r FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',3,'{"full_name":"A Updated","email":"alice@example.invalid","mobile":"111","location":"Kolkata"}','11111111-1111-4111-8111-111111111111');
 IF r.outcome<>'updated' THEN RAISE EXCEPTION 'expected existing-candidate update'; END IF;
 SELECT count(*) INTO n FROM public.candidates; IF n<>1 THEN RAISE EXCEPTION 'sync duplicated person'; END IF;
 SELECT count(*) INTO n FROM public.notifications; IF n<>1 THEN RAISE EXCEPTION 'sync duplicated notification'; END IF;
 INSERT INTO public.candidates(full_name,email,mobile) VALUES('Other','other@example.invalid','222');
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',4,'{"full_name":"Collision","email":"alice@example.invalid","mobile":"222"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'identity collision allowed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT last_synced_row FROM public.google_integrations WHERE id='44444444-4444-4444-8444-444444444444')<>3 THEN RAISE EXCEPTION 'collision moved cursor'; END IF;
 SELECT * INTO r FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',4,'{}','11111111-1111-4111-8111-111111111111');
 IF r.outcome<>'skipped' THEN RAISE EXCEPTION 'blank source row not skipped'; END IF;
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',6,'{"full_name":"Gap"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'gap accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE crm_private.candidate_sync_leases SET expires_at=clock_timestamp()-interval '1 second' WHERE owner_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
 BEGIN PERFORM * FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',5,'{"full_name":"Expired"}','11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'expired lease committed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO n FROM crm_private.candidate_sync_row_ledger; IF n<>3 THEN RAISE EXCEPTION 'ledger count %',n; END IF;
 SELECT count(*) INTO n FROM public.notifications; IF n<>1 THEN RAISE EXCEPTION 'duplicate notification count %',n; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations WHERE id='44444444-4444-4444-8444-444444444444')<>4 THEN RAISE EXCEPTION 'final cursor not 4'; END IF;
END $tests$;
ROLLBACK;
SELECT 'PASS: fenced atomic candidate sync RPC in nonproduction rollback lab' AS outcome,NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='candidate_sync_row_ledger') AS no_remaining_ledger;