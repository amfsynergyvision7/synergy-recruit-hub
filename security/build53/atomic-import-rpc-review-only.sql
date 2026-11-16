-- BUILD53 / REVIEW ONLY — candidate CSV/XLSX create-only atomic batch import.
-- NOT AN ACTIVE MIGRATION; DO NOT APPLY TO STAGING OR PRODUCTION.
-- Requires Build48 strict 67->35 policies AND Build52 crm_write_candidate,
-- exact source fingerprint, security review, signed hosted-user UAT,
-- retention/finance approval, recovery drill, and explicit release approval.
-- The caller may NEVER supply stage, ids, statuses, ownership, or ATS values.
-- Only 1..50 candidate objects are accepted; a failure aborts the ENTIRE batch.
-- No external mail, deletion, billing or direct browser table DML is enabled.
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC,anon,authenticated;
CREATE TABLE crm_private.candidate_import_batches (
 actor_id uuid NOT NULL,
 request_id uuid NOT NULL,
 assignee_id uuid NOT NULL,
 rows_sha256 bytea NOT NULL,
 candidate_ids uuid[] NOT NULL,
 row_count integer NOT NULL CHECK (row_count BETWEEN 1 AND 50),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (actor_id,request_id)
);
ALTER TABLE crm_private.candidate_import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.candidate_import_batches FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_import_candidates_atomic(
 p_request_id uuid, p_assigned_recruiter uuid, p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $import53$
DECLARE
 v_actor uuid := auth.uid();
 v_digest bytea;
 v_prior record;
 v_item record;
 v_row jsonb;
 v_name text;
 v_email text;
 v_phone text;
 v_emails text[] := ARRAY[]::text[];
 v_phones text[] := ARRAY[]::text[];
 v_ids uuid[] := ARRAY[]::uuid[];
 v_id uuid;
 v_count int;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL OR p_assigned_recruiter IS NULL THEN
   RAISE EXCEPTION 'Authenticated batch, request ID and assignee required' USING ERRCODE='42501';
 END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN
   RAISE EXCEPTION 'Candidate import must be a JSON array' USING ERRCODE='22023';
 END IF;
 v_count:=jsonb_array_length(p_rows);
 IF v_count<1 OR v_count>50 OR length(p_rows::text)>200000 THEN
   RAISE EXCEPTION 'Candidate import limit is 1-50 rows and 200 KB' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
   WHERE p.id=v_actor AND p.status='approved' AND p.is_active IS TRUE
     AND r.role='admin'
 ) THEN
   RAISE EXCEPTION 'Only an approved active administrator may import' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
   WHERE p.id=p_assigned_recruiter AND p.status='approved' AND p.is_active IS TRUE
     AND r.role='recruiter'
 ) THEN
   RAISE EXCEPTION 'Import assignee must be an active approved recruiter' USING ERRCODE='42501';
 END IF;

 -- A signed request ID is bound to this exact JSON batch and recruiter.
 -- Do not generate a new request ID on a network retry; unknown outcomes
 -- are resolved by replaying this EXACT request after auth/role rechecks.
 v_digest:=sha256(convert_to(p_rows::text,'UTF8'));
 PERFORM pg_advisory_xact_lock(hashtextextended(
    'crm_candidate_csv_import:'||v_actor::text||':'||p_request_id::text,0
 ));
 SELECT l.* INTO v_prior FROM crm_private.candidate_import_batches l
  WHERE l.actor_id=v_actor AND l.request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF v_prior.rows_sha256<>v_digest
      OR v_prior.assignee_id IS DISTINCT FROM p_assigned_recruiter THEN
     RAISE EXCEPTION 'Request ID was already committed with different content'
       USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('status','replayed',
     'count',v_prior.row_count,'candidate_ids',to_jsonb(v_prior.candidate_ids));
 END IF;

 -- Same lock ordering as Build52: workflow_rules BEFORE candidate writes.
 -- A separate privileged workflow update could override stage/ownership;
 -- fail closed instead of trying to skip its trigger.
 LOCK TABLE public.workflow_rules IN SHARE MODE;
 IF EXISTS(SELECT 1 FROM public.workflow_rules w
    WHERE w.table_name='candidates' AND w.is_active IS TRUE) THEN
   RAISE EXCEPTION 'Active candidate workflow rules require independent review'
     USING ERRCODE='42501';
 END IF;
 -- Every importer takes this table lock, serializing candidate identity scans
 -- with ordinary database writers. This is conservative and intentionally
 -- limited to 50 rows. No partial import commits are possible.
 LOCK TABLE public.candidates IN SHARE ROW EXCLUSIVE MODE;

 -- Verify ALL identities and fields before the first INSERT.
 FOR v_item IN SELECT value AS payload
     FROM jsonb_array_elements(p_rows) AS items(value)
 LOOP
   v_row:=v_item.payload;
   IF jsonb_typeof(v_row)<>'object' OR (v_row -
      ARRAY['full_name','mobile','email','location','position_applied',
      'current_company','experience_years','current_salary','expected_salary',
      'notice_period','resume_url','source','notes']::text[])<>'{}'::jsonb THEN
     RAISE EXCEPTION 'Candidate import contains unsupported fields'
       USING ERRCODE='42501';
   END IF;
   v_name:=nullif(btrim(v_row->>'full_name'),'');
   v_email:=nullif(lower(btrim(v_row->>'email')),'');
   v_phone:=nullif(regexp_replace(coalesce(v_row->>'mobile',''),'[^0-9]','','g'),'');
   IF v_name IS NULL OR length(v_name)>120 THEN
     RAISE EXCEPTION 'Every imported candidate requires a valid full_name'
       USING ERRCODE='22023';
   END IF;
   IF v_email IS NULL AND v_phone IS NULL THEN
     RAISE EXCEPTION 'Every import row needs email or phone for duplicate safety'
       USING ERRCODE='22023';
   END IF;
   IF v_phone IS NOT NULL AND length(v_phone) NOT BETWEEN 8 AND 15 THEN
     RAISE EXCEPTION 'Invalid import mobile number length'
       USING ERRCODE='22023';
   END IF;
   IF (v_email IS NOT NULL AND v_email=ANY(v_emails))
       OR (v_phone IS NOT NULL AND v_phone=ANY(v_phones)) THEN
     RAISE EXCEPTION 'Repeated email or mobile inside candidate batch'
       USING ERRCODE='23505';
   END IF;
   IF EXISTS(
     SELECT 1 FROM public.candidates c
       WHERE (v_email IS NOT NULL AND lower(btrim(c.email))=v_email)
          OR (v_phone IS NOT NULL AND
             nullif(regexp_replace(coalesce(c.mobile,''),'[^0-9]','','g'),'')=v_phone)
   ) THEN
     RAISE EXCEPTION 'Existing candidate email/mobile conflict; manual review required'
       USING ERRCODE='23505';
   END IF;
   IF v_email IS NOT NULL THEN v_emails:=array_append(v_emails,v_email); END IF;
   IF v_phone IS NOT NULL THEN v_phones:=array_append(v_phones,v_phone); END IF;
 END LOOP;

 -- Delegating each record to Build52 enforces the same strict column type,
 -- bounded values, active recruiter assignment, immutable pipeline stage and
 -- privacy-minimal audit. A single failed INSERT rolls back all earlier rows.
 FOR v_item IN SELECT value AS payload
     FROM jsonb_array_elements(p_rows) AS items(value)
 LOOP
   v_id:=public.crm_write_candidate(
      NULL,NULL,
      v_item.payload || jsonb_build_object(
        'assigned_recruiter',p_assigned_recruiter::text
      )
   );
   v_ids:=array_append(v_ids,v_id);
 END LOOP;
 IF cardinality(v_ids)<>v_count THEN
   RAISE EXCEPTION 'Candidate import count mismatch' USING ERRCODE='P0001';
 END IF;
 INSERT INTO crm_private.candidate_import_batches(
   actor_id,request_id,assignee_id,rows_sha256,candidate_ids,row_count
 ) VALUES(
   v_actor,p_request_id,p_assigned_recruiter,v_digest,v_ids,v_count
 );
 -- Intentionally do not log candidate names, contacts, salary or source data.
 INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
 VALUES(v_actor,'crm_candidate_batch_create','candidates',p_request_id::text,
  jsonb_build_object('row_count',v_count,'request_id',p_request_id::text));
 RETURN jsonb_build_object('status','created',
    'count',v_count,'candidate_ids',to_jsonb(v_ids));
END $import53$;
REVOKE ALL ON FUNCTION public.crm_import_candidates_atomic(uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_import_candidates_atomic(uuid,uuid,jsonb)
 TO authenticated;
