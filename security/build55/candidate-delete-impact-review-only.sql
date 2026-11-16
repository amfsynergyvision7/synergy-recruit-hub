-- BUILD55 / REVIEW-ONLY / READ ONLY.
-- Candidate deletion impact assessor. This RPC NEVER deletes, merges or updates
-- candidate data and NEVER grants such authority to the caller.
-- Requires independently approved 67->35 RLS replacement and protected
-- account/role approval RPCs. Must not be installed in live/staging DB yet.
-- Counts referential impact only: it is NOT a complete retention assessment.
CREATE OR REPLACE FUNCTION public.crm_candidate_delete_impact(p_candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $impact55$
DECLARE
  v_actor uuid:=auth.uid();
  v_found uuid;
  v_submissions bigint;
  v_interviews bigint;
  v_offers bigint;
  v_history bigint;
  v_billing bigint;
BEGIN
  IF v_actor IS NULL OR p_candidate_id IS NULL THEN
    RAISE EXCEPTION 'Signed-in administrator and candidate ID required'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=v_actor AND p.status='approved' AND p.is_active IS TRUE
      AND r.role='admin'
  ) THEN
    RAISE EXCEPTION 'Only an approved active administrator may assess deletion'
      USING ERRCODE='42501';
  END IF;
  -- FOR SHARE prevents disappearance during THIS transaction only.
  -- The counts are advisory and can change immediately after commit.
  SELECT c.id INTO v_found FROM public.candidates c
    WHERE c.id=p_candidate_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found' USING ERRCODE='P0002';
  END IF;
  SELECT count(*) INTO v_submissions FROM public.submissions s
   WHERE s.candidate_id=p_candidate_id OR s.candidate_uuid=p_candidate_id;
  SELECT count(*) INTO v_interviews FROM public.interviews i
   WHERE i.candidate_id=p_candidate_id OR i.candidate_uuid=p_candidate_id;
  SELECT count(*) INTO v_offers FROM public.offers o
   WHERE o.candidate_id=p_candidate_id OR o.candidate_uuid=p_candidate_id;
  SELECT count(*) INTO v_history FROM public.candidate_stage_history h
   WHERE h.candidate_id=p_candidate_id;
  SELECT count(*) INTO v_billing FROM public.billing b
   WHERE b.candidate_id=p_candidate_id OR b.candidate_uuid=p_candidate_id;
  -- No PII (names/email/mobile/salary/resumes), no candidate UUID list,
  -- and no estimated retention policy or approval status beyond BLOCKED.
  RETURN jsonb_build_object(
    'operation','review_only',
    'allowed_to_delete',false,
    'status','REQUIRES_INDEPENDENT_RETENTION_AND_FINANCE_APPROVAL',
    'counts_are_transaction_snapshot',true,
    'non_fk_linked_history_not_counted',true,
    'cascade_delete',jsonb_build_object(
      'submissions',v_submissions,
      'interviews',v_interviews,
      'offers',v_offers,
      'candidate_stage_history',v_history
    ),
    'foreign_keys_set_null',jsonb_build_object('billing',v_billing),
    'no_mutation_performed',true
  );
END $impact55$;
REVOKE ALL ON FUNCTION public.crm_candidate_delete_impact(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_candidate_delete_impact(uuid)
 TO authenticated;
