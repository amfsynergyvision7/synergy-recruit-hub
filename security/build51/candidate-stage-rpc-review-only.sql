-- Build51 REVIEW-ONLY FRAGMENT: never apply standalone to hosted databases.
-- Apply ONLY after the exact original 67 policies have been replaced by the
-- approved 35 policies, and after independent business/security acceptance.
-- No invoice/submission/interview/offer-producing transition is permitted.
-- The owning role must be tightly controlled; do not grant CREATE to API roles.
--
-- Critically, the Build48 draft granted UPDATE(stage,notes) to authenticated.
-- Revoke the stage grant after Build48; only this checked RPC may change stage.
REVOKE UPDATE(stage) ON public.candidates FROM authenticated;
GRANT UPDATE(notes) ON public.candidates TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_change_candidate_stage(
  p_candidate_id uuid,
  p_expected_stage text,
  p_new_stage text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $stage51$
DECLARE
  v_actor uuid := auth.uid();
  v_old_stage text;
  v_assigned uuid;
  v_is_admin boolean := false;
BEGIN
  IF v_actor IS NULL OR p_candidate_id IS NULL
     OR p_expected_stage IS NULL OR p_new_stage IS NULL THEN
    RAISE EXCEPTION 'Authenticated candidate transition required' USING ERRCODE='42501';
  END IF;
  -- Only stages that do not execute legacy downstream-automation branches.
  -- These statuses are a review proposal, NOT an approved stage machine.
  IF p_new_stage NOT IN (
    'lead_received','contacted','interested','resume_collected',
    'interview_completed','selected','rejected','dropped'
  ) THEN
    RAISE EXCEPTION 'Stage requires separately approved workflow' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=v_actor AND p.status='approved' AND p.is_active IS TRUE
      AND r.role IN ('admin','recruiter')
  ) THEN
    RAISE EXCEPTION 'Approved active CRM editor required' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id=v_actor AND r.role='admin'
  ) INTO v_is_admin;

  -- Lock target row; expected-old-state prevents lost updates from stale tabs.
  SELECT c.stage::text,c.assigned_recruiter INTO v_old_stage,v_assigned
    FROM public.candidates c WHERE c.id=p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found' USING ERRCODE='P0002';
  END IF;
  IF NOT v_is_admin AND v_assigned IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Candidate assignment does not permit transition' USING ERRCODE='42501';
  END IF;
  IF v_old_stage IS DISTINCT FROM p_expected_stage THEN
    RAISE EXCEPTION 'Candidate changed since last refresh' USING ERRCODE='P0001';
  END IF;
  -- Never reverse a joined record until Finance approves consequences.
  IF v_old_stage='joined' THEN
    RAISE EXCEPTION 'Joined-stage changes require financial review' USING ERRCODE='42501';
  END IF;
  IF v_old_stage=p_new_stage THEN RETURN v_old_stage; END IF;

  UPDATE public.candidates
    SET stage=p_new_stage::public.candidate_stage,
        updated_at=clock_timestamp()
    WHERE id=p_candidate_id;

  -- Audit in the same transaction: failure rolls back the stage UPDATE.
  -- Never log name, email, phone, salary, resume or other candidate PII.
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,'crm_candidate_stage_change','candidates',p_candidate_id::text,
    jsonb_build_object('from',v_old_stage,'to',p_new_stage));
  RETURN p_new_stage;
END $stage51$;
REVOKE ALL ON FUNCTION public.crm_change_candidate_stage(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_change_candidate_stage(uuid,text,text)
  TO authenticated;
