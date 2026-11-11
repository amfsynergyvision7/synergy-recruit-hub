-- BUILD52 REVIEW-ONLY FRAGMENT: audited candidate create / ordinary detail edit.
-- NOT AN ACTIVE MIGRATION. DO NOT APPLY TO STAGING OR PRODUCTION.
-- This fragment must follow the exact 67-to-35 policy replacement and the
-- separately proposed Build51 stage RPC in one independently approved release.
--
-- Browser data writes are revoked for all authenticated users. The RPC runs
-- as a constrained definer only because the narrow validation, role check,
-- ownership validation, row lock and atomic audit must enforce authorization.
-- No email dispatch, deletion, billing or stage transition is authorized.
REVOKE INSERT, UPDATE, DELETE ON public.candidates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_write_candidate(
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_fields jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $candidate52$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_assignee uuid;
  v_old_assignee uuid;
  v_old_updated timestamptz;
  v_record_id uuid;
  v_key text;
  v_audit_fields jsonb;
  v_full_name text;
  v_mobile text;
  v_email text;
  v_location text;
  v_position_applied text;
  v_current_company text;
  v_experience_years numeric;
  v_current_salary numeric;
  v_expected_salary numeric;
  v_notice_period text;
  v_resume_url text;
  v_source text;
  v_notes text;
BEGIN
  IF v_actor IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields)<>'object'
    OR length(p_fields::text)>16000 OR p_fields='{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid authenticated candidate request' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=v_actor AND p.status='approved' AND p.is_active IS TRUE
      AND r.role IN ('admin','recruiter')
  ) THEN
    RAISE EXCEPTION 'Approved active CRM editor required' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles r WHERE r.user_id=v_actor AND r.role='admin'
  ) INTO v_admin;
  FOR v_key IN SELECT jsonb_object_keys(p_fields) LOOP
    IF v_key NOT IN ('full_name','mobile','email','location','position_applied','current_company','experience_years','current_salary','expected_salary','notice_period','resume_url','source','notes','assigned_recruiter') THEN
      RAISE EXCEPTION 'Candidate field is not writable: %',v_key USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF p_fields ? 'full_name' THEN
    IF jsonb_typeof(p_fields->'full_name') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for full_name' USING ERRCODE='22023';
    END IF;
    v_full_name:=nullif(btrim(p_fields->>'full_name'),'');
    IF length(coalesce(v_full_name,''))>120 OR v_full_name IS NULL THEN
      RAISE EXCEPTION 'Invalid full_name' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'mobile' THEN
    IF jsonb_typeof(p_fields->'mobile') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for mobile' USING ERRCODE='22023';
    END IF;
    v_mobile:=nullif(btrim(p_fields->>'mobile'),'');
    IF length(coalesce(v_mobile,''))>32 THEN
      RAISE EXCEPTION 'Invalid mobile' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'email' THEN
    IF jsonb_typeof(p_fields->'email') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for email' USING ERRCODE='22023';
    END IF;
    v_email:=nullif(btrim(p_fields->>'email'),'');
    IF length(coalesce(v_email,''))>320 THEN
      RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'location' THEN
    IF jsonb_typeof(p_fields->'location') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for location' USING ERRCODE='22023';
    END IF;
    v_location:=nullif(btrim(p_fields->>'location'),'');
    IF length(coalesce(v_location,''))>240 THEN
      RAISE EXCEPTION 'Invalid location' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'position_applied' THEN
    IF jsonb_typeof(p_fields->'position_applied') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for position_applied' USING ERRCODE='22023';
    END IF;
    v_position_applied:=nullif(btrim(p_fields->>'position_applied'),'');
    IF length(coalesce(v_position_applied,''))>200 THEN
      RAISE EXCEPTION 'Invalid position_applied' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'current_company' THEN
    IF jsonb_typeof(p_fields->'current_company') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for current_company' USING ERRCODE='22023';
    END IF;
    v_current_company:=nullif(btrim(p_fields->>'current_company'),'');
    IF length(coalesce(v_current_company,''))>200 THEN
      RAISE EXCEPTION 'Invalid current_company' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'experience_years' THEN
    IF jsonb_typeof(p_fields->'experience_years') NOT IN ('number','string','null') THEN
      RAISE EXCEPTION 'Invalid type for experience_years' USING ERRCODE='22023';
    END IF;
    v_experience_years:=nullif(btrim(p_fields->>'experience_years'),'')::numeric;
    IF (v_experience_years IS NOT NULL AND (v_experience_years<0 OR v_experience_years>80)) THEN
      RAISE EXCEPTION 'Invalid experience_years' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'current_salary' THEN
    IF jsonb_typeof(p_fields->'current_salary') NOT IN ('number','string','null') THEN
      RAISE EXCEPTION 'Invalid type for current_salary' USING ERRCODE='22023';
    END IF;
    v_current_salary:=nullif(btrim(p_fields->>'current_salary'),'')::numeric;
    IF (v_current_salary IS NOT NULL AND (v_current_salary<0 OR v_current_salary>1000000000)) THEN
      RAISE EXCEPTION 'Invalid current_salary' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'expected_salary' THEN
    IF jsonb_typeof(p_fields->'expected_salary') NOT IN ('number','string','null') THEN
      RAISE EXCEPTION 'Invalid type for expected_salary' USING ERRCODE='22023';
    END IF;
    v_expected_salary:=nullif(btrim(p_fields->>'expected_salary'),'')::numeric;
    IF (v_expected_salary IS NOT NULL AND (v_expected_salary<0 OR v_expected_salary>1000000000)) THEN
      RAISE EXCEPTION 'Invalid expected_salary' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'notice_period' THEN
    IF jsonb_typeof(p_fields->'notice_period') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for notice_period' USING ERRCODE='22023';
    END IF;
    v_notice_period:=nullif(btrim(p_fields->>'notice_period'),'');
    IF length(coalesce(v_notice_period,''))>120 THEN
      RAISE EXCEPTION 'Invalid notice_period' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'resume_url' THEN
    IF jsonb_typeof(p_fields->'resume_url') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for resume_url' USING ERRCODE='22023';
    END IF;
    v_resume_url:=nullif(btrim(p_fields->>'resume_url'),'');
    IF length(coalesce(v_resume_url,''))>2048 THEN
      RAISE EXCEPTION 'Invalid resume_url' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'source' THEN
    IF jsonb_typeof(p_fields->'source') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for source' USING ERRCODE='22023';
    END IF;
    v_source:=nullif(btrim(p_fields->>'source'),'');
    IF length(coalesce(v_source,''))>120 THEN
      RAISE EXCEPTION 'Invalid source' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'notes' THEN
    IF jsonb_typeof(p_fields->'notes') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Invalid type for notes' USING ERRCODE='22023';
    END IF;
    v_notes:=nullif(btrim(p_fields->>'notes'),'');
    IF length(coalesce(v_notes,''))>10000 THEN
      RAISE EXCEPTION 'Invalid notes' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_fields ? 'email' AND v_email IS NOT NULL
    AND (position('@' IN v_email)=0 OR position(' ' IN v_email)>0) THEN
    RAISE EXCEPTION 'Invalid email address' USING ERRCODE='22023';
  END IF;
  IF p_fields ? 'resume_url' AND v_resume_url IS NOT NULL
    AND v_resume_url !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Resume URL must use HTTPS' USING ERRCODE='22023';
  END IF;
  IF p_fields ? 'assigned_recruiter'
     AND jsonb_typeof(p_fields->'assigned_recruiter') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'Invalid recruiter type' USING ERRCODE='22023';
  END IF;
  IF p_fields ? 'assigned_recruiter' AND NOT v_admin THEN
    RAISE EXCEPTION 'Recruiter assignment is administrator-only' USING ERRCODE='42501';
  END IF;

  IF p_candidate_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL OR v_full_name IS NULL THEN
      RAISE EXCEPTION 'Creation needs full name and no prior version' USING ERRCODE='22023';
    END IF;
    IF v_admin THEN
      IF nullif(p_fields->>'assigned_recruiter','') IS NULL THEN
        RAISE EXCEPTION 'Choose an approved recruiter for assignment' USING ERRCODE='22023';
      END IF;
      v_assignee := (p_fields->>'assigned_recruiter')::uuid;
    ELSE
      v_assignee := v_actor;
    END IF;
  ELSE
    IF p_expected_updated_at IS NULL THEN
      RAISE EXCEPTION 'Candidate edits require expected version' USING ERRCODE='22023';
    END IF;
    SELECT c.assigned_recruiter,c.updated_at
      INTO v_old_assignee,v_old_updated
      FROM public.candidates c WHERE c.id=p_candidate_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Candidate not found' USING ERRCODE='P0002';
    END IF;
    IF NOT v_admin AND v_old_assignee IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Cannot edit another recruiter''s candidate' USING ERRCODE='42501';
    END IF;
    IF v_old_updated IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Candidate changed since your last refresh' USING ERRCODE='P0001';
    END IF;
    v_assignee := v_old_assignee;
    IF p_fields ? 'assigned_recruiter' THEN
      IF nullif(p_fields->>'assigned_recruiter','') IS NULL THEN
        RAISE EXCEPTION 'Unassignment requires separately approved workflow' USING ERRCODE='42501';
      END IF;
      v_assignee := (p_fields->>'assigned_recruiter')::uuid;
    END IF;
  END IF;
  -- Only validate a freshly assigned recruiter, not an unchanged legacy
  -- assignee who may have been suspended since the candidate was created.
  IF p_candidate_id IS NULL OR p_fields ? 'assigned_recruiter' THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
      WHERE p.id=v_assignee AND p.status='approved'
        AND p.is_active IS TRUE AND r.role='recruiter'
    ) THEN
      RAISE EXCEPTION 'Assignment requires an approved active recruiter' USING ERRCODE='42501';
    END IF;
  END IF;

  IF p_candidate_id IS NULL THEN
    INSERT INTO public.candidates(
      full_name,
      mobile,
      email,
      location,
      position_applied,
      current_company,
      experience_years,
      current_salary,
      expected_salary,
      notice_period,
      resume_url,
      source,
      notes,
      assigned_recruiter,
      created_by,
      stage,
      status,
      updated_at
    ) VALUES(
      v_full_name,
      v_mobile,
      v_email,
      v_location,
      v_position_applied,
      v_current_company,
      v_experience_years,
      v_current_salary,
      v_expected_salary,
      v_notice_period,
      v_resume_url,
      v_source,
      v_notes,
      v_assignee,
      v_actor,
      'lead_received'::public.candidate_stage,
      'active',
      clock_timestamp()
    ) RETURNING id INTO v_record_id;
  ELSE
    -- Stage, candidate code, ownership, timestamps, ATS, creator, status and
    -- billing never come from arbitrary browser JSON.
    UPDATE public.candidates c
       SET
        full_name=CASE WHEN p_fields ? 'full_name' THEN v_full_name ELSE c.full_name END,
        mobile=CASE WHEN p_fields ? 'mobile' THEN v_mobile ELSE c.mobile END,
        email=CASE WHEN p_fields ? 'email' THEN v_email ELSE c.email END,
        location=CASE WHEN p_fields ? 'location' THEN v_location ELSE c.location END,
        position_applied=CASE WHEN p_fields ? 'position_applied' THEN v_position_applied ELSE c.position_applied END,
        current_company=CASE WHEN p_fields ? 'current_company' THEN v_current_company ELSE c.current_company END,
        experience_years=CASE WHEN p_fields ? 'experience_years' THEN v_experience_years ELSE c.experience_years END,
        current_salary=CASE WHEN p_fields ? 'current_salary' THEN v_current_salary ELSE c.current_salary END,
        expected_salary=CASE WHEN p_fields ? 'expected_salary' THEN v_expected_salary ELSE c.expected_salary END,
        notice_period=CASE WHEN p_fields ? 'notice_period' THEN v_notice_period ELSE c.notice_period END,
        resume_url=CASE WHEN p_fields ? 'resume_url' THEN v_resume_url ELSE c.resume_url END,
        source=CASE WHEN p_fields ? 'source' THEN v_source ELSE c.source END,
        notes=CASE WHEN p_fields ? 'notes' THEN v_notes ELSE c.notes END,
        assigned_recruiter=v_assignee,
        updated_at=clock_timestamp()
     WHERE c.id=p_candidate_id
    RETURNING c.id INTO v_record_id;
  END IF;

  SELECT coalesce(jsonb_agg(v.k ORDER BY v.k),'[]'::jsonb)
    INTO v_audit_fields
    FROM (SELECT jsonb_object_keys(p_fields) AS k) v;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,
    CASE WHEN p_candidate_id IS NULL THEN 'crm_candidate_create' ELSE 'crm_candidate_update' END,
    'candidates',v_record_id::text,jsonb_build_object('changed_fields',v_audit_fields));
  -- Audit failures abort the entire mutation, even after candidate triggers.
  RETURN v_record_id;
END $candidate52$;

REVOKE ALL ON FUNCTION public.crm_write_candidate(uuid,timestamptz,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_candidate(uuid,timestamptz,jsonb)
 TO authenticated;
