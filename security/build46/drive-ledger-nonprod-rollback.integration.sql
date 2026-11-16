-- Build46 synthetic source-shaped Drive ledger rollback. NEVER deploy this fixture.
BEGIN;
SET LOCAL statement_timeout='30s';
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','joined');
CREATE TABLE public.profiles(id uuid PRIMARY KEY,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.app_settings(id integer PRIMARY KEY,resume_import_folder_url text);
CREATE TABLE public.candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text NOT NULL,
 email text,mobile text,position_applied text,experience_years numeric,resume_url text,
 source text,stage public.candidate_stage DEFAULT 'lead_received',status text,
 created_source text,assigned_recruiter uuid
);
INSERT INTO public.profiles VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),('11111111-1111-4111-8111-111111111111','approved',true),
 ('22222222-2222-4222-8222-222222222222','pending',true),('33333333-3333-4333-8333-333333333333','approved',false);
INSERT INTO public.user_roles VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('11111111-1111-4111-8111-111111111111','recruiter'),
 ('22222222-2222-4222-8222-222222222222','recruiter'),('33333333-3333-4333-8333-333333333333','recruiter');
INSERT INTO public.app_settings VALUES(1,'https://drive.google.com/drive/folders/folderABC123?usp=sharing');

CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC,anon,authenticated;
CREATE TABLE crm_private.drive_resume_import_ledger (
  file_id text PRIMARY KEY,
  folder_id text NOT NULL,
  owner_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  payload_fingerprint text NOT NULL,
  action text NOT NULL CHECK(action IN ('created','updated')),
  fields_filled text[] NOT NULL DEFAULT ARRAY[]::text[],
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  CHECK(folder_id ~ '^[A-Za-z0-9_-]{10,200}$')
);
ALTER TABLE crm_private.drive_resume_import_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.drive_resume_import_ledger FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.crm_commit_drive_resume_import(
  p_owner uuid,
  p_assigned_recruiter uuid,
  p_folder_id text,
  p_file_id text,
  p_extracted jsonb
) RETURNS TABLE(outcome text,candidate_id uuid,fields_filled text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_url text;
 v_folder text;
 v_name text;
 v_email text;
 v_mobile text;
 v_position text;
 v_resume_url text;
 v_years numeric;
 v_years_raw text;
 v_hash text;
 v_prior record;
 v_found record;
 v_count bigint;
 v_id uuid;
 v_fields text[]:=ARRAY[]::text[];
BEGIN
 IF p_owner IS NULL OR p_assigned_recruiter IS NULL
 OR p_folder_id IS NULL OR p_folder_id !~ '^[A-Za-z0-9_-]{10,200}$'
 OR p_file_id IS NULL OR p_file_id !~ '^[A-Za-z0-9_-]{10,200}$'
 OR p_extracted IS NULL OR jsonb_typeof(p_extracted)<>'object' THEN
    RAISE EXCEPTION 'Invalid Drive import input' USING ERRCODE='22023';
 END IF;
 IF (p_extracted-ARRAY['full_name','email','mobile','position_applied','experience_years'])<>'{}'::jsonb THEN
    RAISE EXCEPTION 'Unsupported Drive extracted fields' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=p_owner AND p.status='approved' AND p.is_active IS TRUE AND r.role='admin') THEN
    RAISE EXCEPTION 'Drive import owner not approved administrator' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=p_assigned_recruiter AND p.status='approved' AND p.is_active IS TRUE AND r.role='recruiter') THEN
    RAISE EXCEPTION 'Drive import recruiter not approved and active' USING ERRCODE='42501';
 END IF;
 -- Only the admin-configured folder is eligible, never a user-supplied arbitrary folder.
 SELECT s.resume_import_folder_url INTO v_url
 FROM public.app_settings s WHERE s.id=1 FOR SHARE;
 v_folder:=substring(coalesce(v_url,'') from '/folders/([A-Za-z0-9_-]{10,200})');
 IF v_folder IS NULL OR v_folder<>p_folder_id THEN
    RAISE EXCEPTION 'Drive import folder not approved' USING ERRCODE='42501';
 END IF;
 v_name:=nullif(btrim(p_extracted->>'full_name'),'');
 v_email:=nullif(lower(btrim(p_extracted->>'email')),'');
 v_mobile:=nullif(regexp_replace(coalesce(p_extracted->>'mobile',''),'[^0-9]','','g'),'');
 v_position:=nullif(btrim(p_extracted->>'position_applied'),'');
 v_years_raw:=nullif(btrim(p_extracted->>'experience_years'),'');
 IF v_name IS NULL OR lower(v_name)='na' OR length(v_name)>512
    OR (v_email IS NULL AND v_mobile IS NULL)
    OR length(coalesce(v_email,''))>320 OR length(coalesce(v_mobile,''))>64
    OR length(coalesce(v_position,''))>512 THEN
    RAISE EXCEPTION 'Insufficient or invalid candidate identity: manual review required' USING ERRCODE='22023';
 END IF;
 IF v_years_raw IS NOT NULL THEN
   IF v_years_raw !~ '^[0-9]{1,2}(\.[0-9]{1,2})?$' THEN
       RAISE EXCEPTION 'Invalid candidate years of experience' USING ERRCODE='22023';
   END IF;
   v_years:=v_years_raw::numeric;
   IF v_years>80 THEN RAISE EXCEPTION 'Experience out of supported range' USING ERRCODE='22023'; END IF;
 END IF;
 v_resume_url:='https://drive.google.com/file/d/'||p_file_id||'/view';
 v_hash:=md5(p_extracted::text);
 -- Serialise cooperating Sheets and Drive imports. Manual candidate writes
 -- outside this protocol are NOT protected and remain a release blocker.
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_candidate_sync_importers',0));
 SELECT l.owner_id,l.folder_id,l.candidate_id,l.payload_fingerprint,l.fields_filled
 INTO v_prior FROM crm_private.drive_resume_import_ledger l WHERE l.file_id=p_file_id;
 IF FOUND THEN
   IF v_prior.owner_id<>p_owner OR v_prior.folder_id<>p_folder_id
      OR v_prior.payload_fingerprint<>v_hash THEN
     RAISE EXCEPTION 'Drive file reused or changed: manual review required' USING ERRCODE='23505';
   END IF;
   RETURN QUERY SELECT 'replayed'::text,v_prior.candidate_id,v_prior.fields_filled;
   RETURN;
 END IF;
 -- Refuse silently reimporting a legacy file whose resume_url predates
 -- the ledger. The historic corpus requires explicit one-time reconciliation.
 IF EXISTS(
   SELECT 1 FROM public.candidates c
   WHERE substring(coalesce(c.resume_url,'') from '/file/d/([A-Za-z0-9_-]{10,200})')=p_file_id
      OR substring(coalesce(c.resume_url,'') from '[?&]id=([A-Za-z0-9_-]{10,200})')=p_file_id
 ) THEN RAISE EXCEPTION 'Legacy Drive file requires ledger reconciliation' USING ERRCODE='23505'; END IF;
 SELECT count(*),min(c.id::text)::uuid INTO v_count,v_id
 FROM public.candidates c
 WHERE (v_email IS NOT NULL AND lower(btrim(c.email))=v_email)
    OR (v_mobile IS NOT NULL AND regexp_replace(coalesce(c.mobile,''),'[^0-9]','','g')=v_mobile);
 IF v_count>1 THEN
   RAISE EXCEPTION 'Ambiguous existing candidate: manual review required' USING ERRCODE='23505';
 END IF;
 IF v_id IS NULL THEN
   INSERT INTO public.candidates(
      full_name,email,mobile,position_applied,experience_years,resume_url,
      source,stage,status,created_source,assigned_recruiter
   ) VALUES(
      v_name,v_email,v_mobile,v_position,v_years,v_resume_url,
      'Google Drive Bulk Import','lead_received','active','drive_resume_import',p_assigned_recruiter
   ) RETURNING id INTO v_id;
   v_fields:=ARRAY['full_name','email','mobile','position_applied','experience_years','resume_url']::text[];
   INSERT INTO crm_private.drive_resume_import_ledger(
     file_id,folder_id,owner_id,candidate_id,payload_fingerprint,action,fields_filled
   ) VALUES(p_file_id,p_folder_id,p_owner,v_id,v_hash,'created',v_fields);
   RETURN QUERY SELECT 'created'::text,v_id,v_fields;
 ELSE
   SELECT c.full_name,c.email,c.mobile,c.position_applied,c.experience_years,c.resume_url
   INTO v_found FROM public.candidates c WHERE c.id=v_id FOR UPDATE;
   v_fields:=array_remove(ARRAY[
     CASE WHEN nullif(btrim(v_found.full_name),'') IS NULL THEN 'full_name'::text END,
     CASE WHEN nullif(btrim(v_found.email),'') IS NULL AND v_email IS NOT NULL THEN 'email'::text END,
     CASE WHEN nullif(btrim(v_found.mobile),'') IS NULL AND v_mobile IS NOT NULL THEN 'mobile'::text END,
     CASE WHEN nullif(btrim(v_found.position_applied),'') IS NULL AND v_position IS NOT NULL THEN 'position_applied'::text END,
     CASE WHEN v_found.experience_years IS NULL AND v_years IS NOT NULL THEN 'experience_years'::text END,
     CASE WHEN nullif(btrim(v_found.resume_url),'') IS NULL THEN 'resume_url'::text END
   ],NULL);
   UPDATE public.candidates c SET
     full_name=coalesce(nullif(btrim(c.full_name),''),v_name),
     email=coalesce(nullif(btrim(c.email),''),v_email),
     mobile=coalesce(nullif(btrim(c.mobile),''),v_mobile),
     position_applied=coalesce(nullif(btrim(c.position_applied),''),v_position),
     experience_years=coalesce(c.experience_years,v_years),
     resume_url=coalesce(nullif(btrim(c.resume_url),''),v_resume_url)
   WHERE c.id=v_id;
   INSERT INTO crm_private.drive_resume_import_ledger(
     file_id,folder_id,owner_id,candidate_id,payload_fingerprint,action,fields_filled
   ) VALUES(p_file_id,p_folder_id,p_owner,v_id,v_hash,'updated',v_fields);
   RETURN QUERY SELECT 'updated'::text,v_id,v_fields;
 END IF;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb) TO service_role;
CREATE FUNCTION public.crm_list_drive_imported_file_ids(
 p_owner uuid,p_folder_id text
) RETURNS TABLE(file_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $list$
DECLARE v_url text; v_folder text;
BEGIN
 IF p_folder_id IS NULL OR p_folder_id !~ '^[A-Za-z0-9_-]{10,200}$' THEN
   RAISE EXCEPTION 'Invalid Drive folder' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=p_owner AND p.status='approved' AND p.is_active IS TRUE AND r.role='admin')
 THEN RAISE EXCEPTION 'Drive import owner not authorized' USING ERRCODE='42501'; END IF;
 SELECT s.resume_import_folder_url INTO v_url FROM public.app_settings s WHERE s.id=1;
 v_folder:=substring(coalesce(v_url,'') from '/folders/([A-Za-z0-9_-]{10,200})');
 IF v_folder IS NULL OR v_folder<>p_folder_id THEN
   RAISE EXCEPTION 'Drive import folder not approved' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT l.file_id FROM crm_private.drive_resume_import_ledger l
 WHERE l.owner_id=p_owner AND l.folder_id=p_folder_id ORDER BY l.file_id;
END $list$;
REVOKE EXECUTE ON FUNCTION public.crm_list_drive_imported_file_ids(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_list_drive_imported_file_ids(uuid,text) TO service_role;
CREATE FUNCTION public.build46_injected_failure() RETURNS trigger LANGUAGE plpgsql AS $trap$
BEGIN IF current_setting('build46.fail',true)='on' THEN RAISE EXCEPTION 'synthetic trigger failure' USING ERRCODE='P9001'; END IF; RETURN NEW; END $trap$;
CREATE TRIGGER build46_abort AFTER INSERT ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.build46_injected_failure();
DO $check$ DECLARE x record; initial_id uuid; n int;BEGIN
 IF has_function_privilege('anon','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anonymous RPC permission'; END IF;
 IF has_function_privilege('authenticated','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'auth RPC permission'; END IF;
 IF NOT has_function_privilege('service_role','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'service RPC grant missing'; END IF;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"A","email":"a@example.invalid"}'); RAISE EXCEPTION 'recruiter owner allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','folderABC123','driveFileABC123','{"full_name":"A","email":"a@example.invalid"}'); RAISE EXCEPTION 'pending assignee allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','folderABC123','driveFileABC123','{"full_name":"A","email":"a@example.invalid"}'); RAISE EXCEPTION 'inactive assignee allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','anotherFolderABC123','driveFileABC123','{"full_name":"A","email":"a@example.invalid"}'); RAISE EXCEPTION 'folder swap allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"A","email":"a@example.invalid","stage":"joined"}'); RAISE EXCEPTION 'extra JSON field allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"A"}'); RAISE EXCEPTION 'name alone allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('build46.fail','on',true);
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"Alice","email":"alice@example.invalid"}'); RAISE EXCEPTION 'failure not injected'; EXCEPTION WHEN SQLSTATE 'P9001' THEN NULL; END;
 PERFORM set_config('build46.fail','off',true);
 IF (SELECT count(*) FROM public.candidates)<>0 OR (SELECT count(*) FROM crm_private.drive_resume_import_ledger)<>0 THEN RAISE EXCEPTION 'partial transaction survived failure'; END IF;
 SELECT * INTO x FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"Alice","email":"alice@example.invalid","mobile":"9876543210","position_applied":"Analyst"}');
 IF x.outcome<>'created' OR x.candidate_id IS NULL THEN RAISE EXCEPTION 'first Drive resume not created'; END IF;
 initial_id:=x.candidate_id;
 IF (SELECT assigned_recruiter FROM public.candidates WHERE id=initial_id)<>'11111111-1111-4111-8111-111111111111'::uuid THEN RAISE EXCEPTION 'approved recruiter not assigned'; END IF;
 SELECT * INTO x FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"position_applied":"Analyst","mobile":"9876543210","email":"alice@example.invalid","full_name":"Alice"}');
 IF x.outcome<>'replayed' OR x.candidate_id<>initial_id THEN RAISE EXCEPTION 'Drive ID replay not stable'; END IF;
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','driveFileABC123','{"full_name":"Alicia","email":"alice@example.invalid"}'); RAISE EXCEPTION 'changed file replay allowed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT * INTO x FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','otherFileABC123','{"full_name":"Override Attempt","email":"alice@example.invalid","mobile":"9876543210","position_applied":"Manager","experience_years":"7"}');
 IF x.outcome<>'updated' OR x.candidate_id<>initial_id THEN RAISE EXCEPTION 'existing candidate not matched'; END IF;
 IF (SELECT full_name FROM public.candidates WHERE id=initial_id)<>'Alice'
    OR (SELECT position_applied FROM public.candidates WHERE id=initial_id)<>'Analyst'
    OR (SELECT experience_years FROM public.candidates WHERE id=initial_id)<>7
    OR (SELECT resume_url FROM public.candidates WHERE id=initial_id)<>'https://drive.google.com/file/d/driveFileABC123/view'
 THEN RAISE EXCEPTION 'existing manual fields overwritten or blank fill failed'; END IF;
 INSERT INTO public.candidates(full_name,email,mobile) VALUES('Other','other@example.invalid','2223334444');
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','collisionFileABC123','{"full_name":"Duplicate","email":"alice@example.invalid","mobile":"2223334444"}'); RAISE EXCEPTION 'ambiguous match allowed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT count(*) FROM crm_private.drive_resume_import_ledger)<>2 THEN RAISE EXCEPTION 'expected 2 file ledger entries'; END IF;
 SELECT count(*) INTO n FROM public.crm_list_drive_imported_file_ids('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','folderABC123');
 IF n<>2 THEN RAISE EXCEPTION 'ledger listing count %',n; END IF;
 BEGIN PERFORM * FROM public.crm_list_drive_imported_file_ids('11111111-1111-4111-8111-111111111111','folderABC123'); RAISE EXCEPTION 'recruiter could list import ledger'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.crm_list_drive_imported_file_ids('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','anotherFolderABC123'); RAISE EXCEPTION 'wrong folder could list import ledger'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.candidates(full_name,email,resume_url) VALUES('Legacy Person','legacy@example.invalid','https://drive.google.com/file/d/legacyDriveABC123/view');
 BEGIN PERFORM * FROM public.crm_commit_drive_resume_import('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','folderABC123','legacyDriveABC123','{"full_name":"Legacy Person","email":"legacy@example.invalid"}'); RAISE EXCEPTION 'legacy file silently reprocessed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT count(*) FROM public.candidates)<>3 THEN RAISE EXCEPTION 'duplicate candidate insert or legacy seed missing'; END IF;
END $check$;
ROLLBACK;
SELECT 'PASS: Build46 Drive ledger rejects invalid owner, recruiter, folder, duplicate, collision and rollback' AS outcome,
 NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='drive_resume_import_ledger') AS no_persistent_ledger;
