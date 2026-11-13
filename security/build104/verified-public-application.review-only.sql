-- BUILD104 / REVIEW ONLY. DO NOT APPLY TO A HOSTED OR PRODUCTION DATABASE.
-- This source is intended exclusively for disposable PostgreSQL rehearsal until
-- an independently approved applicant-verification issuer, privacy/rate-limit
-- policy, backup/restore and migration release gate exist.
--
-- The authenticated applicant verification proof table has NO public writer
-- and this file DOES NOT IMPLEMENT PROOF ISSUANCE. Thus a developer cannot
-- enable public applications simply by removing the TypeScript release hold.
-- Full acceptance also requires validating production triggers separately.

CREATE SCHEMA IF NOT EXISTS crm_private;

CREATE TABLE crm_private.verified_public_applications (
  proof_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  job_id uuid NOT NULL,
  verified_email text NOT NULL,
  verified_mobile text NOT NULL,
  email_verified_at timestamptz NOT NULL,
  mobile_verified_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  candidate_id uuid,
  submission_id uuid,
  CONSTRAINT public_applicant_email_canonical
    CHECK (verified_email = pg_catalog.lower(pg_catalog.btrim(verified_email))
      AND pg_catalog.length(verified_email) BETWEEN 3 AND 320),
  CONSTRAINT public_applicant_phone_canonical
    CHECK (verified_mobile ~ '^[0-9]{10}$'),
  CONSTRAINT public_applicant_proof_duration
    CHECK (expires_at > email_verified_at AND expires_at > mobile_verified_at
      AND expires_at <= email_verified_at + interval '15 minutes'
      AND expires_at <= mobile_verified_at + interval '15 minutes'),
  CONSTRAINT public_applicant_consumption_consistent
    CHECK ((consumed_at IS NULL AND candidate_id IS NULL AND submission_id IS NULL)
       OR (consumed_at IS NOT NULL AND candidate_id IS NOT NULL AND submission_id IS NOT NULL))
);
ALTER TABLE crm_private.verified_public_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_private.verified_public_applications FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.crm_commit_verified_public_application(
  p_proof_id uuid, p_job_id uuid,
  p_full_name text, p_email text, p_mobile text,
  p_current_company text DEFAULT NULL,
  p_experience_years numeric DEFAULT NULL,
  p_expected_salary numeric DEFAULT NULL,
  p_notice_period text DEFAULT NULL,
  p_resume_url text DEFAULT NULL,
  p_cover_note text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $fn$
DECLARE
  v_proof crm_private.verified_public_applications%ROWTYPE;
  v_email text;
  v_phone text;
  v_job record;
  v_candidate uuid;
  v_submission uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  -- Independent verifier must have issued the proof: no issuer is present
  -- in Build104, and a caller cannot write to the private proof table.
  IF p_proof_id IS NULL OR p_job_id IS NULL
      OR p_full_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_full_name)) NOT BETWEEN 2 AND 200
      OR p_email IS NULL OR p_mobile IS NULL
      OR p_current_company IS NOT NULL AND pg_catalog.length(p_current_company) > 200
      OR p_experience_years IS NOT NULL AND (p_experience_years < 0 OR p_experience_years > 60)
      OR p_expected_salary IS NOT NULL AND p_expected_salary < 0
      OR p_notice_period IS NOT NULL AND pg_catalog.length(p_notice_period) > 100
      OR p_resume_url IS NOT NULL AND pg_catalog.length(p_resume_url) > 2048
      OR p_cover_note IS NOT NULL AND pg_catalog.length(p_cover_note) > 2000
  THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;
  v_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_phone := pg_catalog.right(pg_catalog.regexp_replace(p_mobile,'[^0-9]','','g'),10);
  IF pg_catalog.length(v_email) NOT BETWEEN 3 AND 320 OR
     pg_catalog.length(v_phone) <> 10 THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;

  -- Lock the proof for all retries, including two concurrent requests.
  SELECT * INTO v_proof FROM crm_private.verified_public_applications
    WHERE proof_id = p_proof_id FOR UPDATE;
  IF NOT FOUND OR v_proof.job_id IS DISTINCT FROM p_job_id
      OR v_proof.verified_email IS DISTINCT FROM v_email
      OR v_proof.verified_mobile IS DISTINCT FROM v_phone
      OR v_proof.email_verified_at > v_now
      OR v_proof.mobile_verified_at > v_now THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;
  IF v_proof.consumed_at IS NOT NULL THEN
    -- Exactly one candidate/submission pair was already committed.
    RETURN 'already_applied';
  END IF;
  -- This lock may have waited behind another request. Use the post-lock
  -- clock, not the timestamp captured before waiting, to enforce expiry.
  v_now := pg_catalog.clock_timestamp();
  IF v_proof.expires_at <= v_now THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;

  -- Both email and phone must remain uncontested until commit.
  -- Advisory locks serialize independent proof IDs with shared contacts.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('career/email/'||v_email,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('career/phone/'||v_phone,0));

  SELECT id, job_title, assigned_recruiter INTO v_job
    FROM public.job_openings WHERE id=p_job_id AND status='open' FOR SHARE;
  IF NOT FOUND OR v_job.job_title IS NULL THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidates c
             WHERE pg_catalog.lower(pg_catalog.btrim(c.email))=v_email
              OR pg_catalog.right(pg_catalog.regexp_replace(pg_catalog.coalesce(c.mobile,''),'[^0-9]','','g'),10)=v_phone) THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;

  -- All three writes occur in one PostgreSQL transaction/statement.
  -- A failing submission trigger or update rolls back the candidate INSERT.
  INSERT INTO public.candidates(
    full_name,email,mobile,current_company,experience_years,expected_salary,
    notice_period,resume_url,position_applied,source,assigned_recruiter,stage,status
  ) VALUES (
    pg_catalog.btrim(p_full_name),v_email,p_mobile,
    NULLIF(p_current_company,''),p_experience_years,p_expected_salary,
    NULLIF(p_notice_period,''),NULLIF(p_resume_url,''),
    v_job.job_title,'career_page',v_job.assigned_recruiter,'lead_received','active'
  ) RETURNING id INTO v_candidate;

  INSERT INTO public.submissions(
    candidate_id,candidate_uuid,job_uuid,role_title,status,remarks
  ) VALUES (
    v_candidate,v_candidate,p_job_id,v_job.job_title,'submitted',
    NULLIF(p_cover_note,'')
  ) RETURNING id INTO v_submission;

  UPDATE crm_private.verified_public_applications
    SET consumed_at = pg_catalog.clock_timestamp(),
        candidate_id=v_candidate,submission_id=v_submission
    WHERE proof_id=p_proof_id AND consumed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application unavailable' USING ERRCODE='22023';
  END IF;
  RETURN 'accepted';
END
$fn$;

-- Supabase's default EXECUTE privilege is PUBLIC: revoke explicitly.
REVOKE ALL ON FUNCTION public.crm_commit_verified_public_application(
  uuid,uuid,text,text,text,text,numeric,numeric,text,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_commit_verified_public_application(
  uuid,uuid,text,text,text,text,numeric,numeric,text,text,text
) TO service_role;
