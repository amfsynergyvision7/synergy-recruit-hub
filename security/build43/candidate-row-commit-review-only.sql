-- BUILD 43 REVIEW-ONLY: fenced, idempotent, single-transaction Google Sheet row commit.
-- NOT AN ACTIVE MIGRATION. DO NOT RUN AGAINST STAGING OR PRODUCTION.
-- Requires independent security/trigger/restore review and formal release gates.
BEGIN;
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
 p_owner uuid,p_token uuid,p_integration uuid,p_row_number integer,p_candidate jsonb
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
       source,notes,stage,status,created_source
     ) VALUES (
       v_name,v_mobile,v_email,nullif(p_candidate->>'location',''),
       nullif(p_candidate->>'position_applied',''),nullif(p_candidate->>'current_company',''),
       nullif(p_candidate->>'experience_years','')::numeric,
       nullif(p_candidate->>'current_salary','')::numeric,
       nullif(p_candidate->>'expected_salary','')::numeric,
       nullif(p_candidate->>'notice_period',''),nullif(p_candidate->>'resume_url',''),
       coalesce(nullif(p_candidate->>'source',''),'Google Form'),
       nullif(p_candidate->>'notes',''),'lead_received','active','google_form_sync'
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
REVOKE EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)
 TO service_role;
COMMIT;
-- Reviewer blockers: manual/importer writes outside this RPC remain non-fenced;
-- real triggers including workflow/notification side effects require coverage;
-- input field policy, note overwrites, and service-role ownership need review.
