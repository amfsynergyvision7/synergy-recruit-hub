-- Build105 synthetic, disposable, source-derived trigger compatibility tests.
-- The composer places this AFTER the Build44 baseline, real submission
-- trigger snapshot, production-like PK/FK constraints, and Build104 function.
INSERT INTO public.job_openings(id,job_title,status,open_positions)
 VALUES ('11111111-1111-4111-8111-111111111111','Fictional Analyst','open',1),
        ('22222222-2222-4222-8222-222222222222','Closed Synthetic Job','closed',1);

DO $acl$
DECLARE
  signature text := 'public.crm_commit_verified_public_application(uuid,uuid,text,text,text,text,numeric,numeric,text,text,text)';
BEGIN
  IF pg_catalog.has_function_privilege('anon',signature,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',signature,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role',signature,'EXECUTE') THEN
     RAISE EXCEPTION 'Build105 FAIL: RPC grants violated';
  END IF;
  IF pg_catalog.has_table_privilege('service_role','crm_private.verified_public_applications','INSERT')
     OR pg_catalog.has_table_privilege('anon','crm_private.verified_public_applications','SELECT') THEN
     RAISE EXCEPTION 'Build105 FAIL: private proof ledger exposed';
  END IF;
END $acl$;

-- Fixture proof issuance performed by disposable postgres role ONLY.
-- No production issuer, credentials or real applicant data is involved.
INSERT INTO crm_private.verified_public_applications
 (proof_id,job_id,verified_email,verified_mobile,email_verified_at,mobile_verified_at,expires_at)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','synthetic1@example.invalid','9876543210',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','synthetic2@example.invalid','9876543211',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','11111111-1111-4111-8111-111111111111','synthetic3@example.invalid','9876543212',clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','22222222-2222-4222-8222-222222222222','synthetic4@example.invalid','9876543213',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','11111111-1111-4111-8111-111111111111','synthetic1@example.invalid','9876543214',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '5 minutes');

SET LOCAL ROLE service_role;
DO $case$
DECLARE x text;
BEGIN
  SELECT public.crm_commit_verified_public_application(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic Applicant 1','SYNTHETIC1@EXAMPLE.INVALID','+91 9876543210'
  ) INTO x;
  IF x <> 'accepted' THEN RAISE EXCEPTION 'Build105 FAIL: first commit %',x; END IF;
  SELECT public.crm_commit_verified_public_application(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic Applicant 1','synthetic1@example.invalid','9876543210'
  ) INTO x;
  IF x <> 'already_applied' THEN RAISE EXCEPTION 'Build105 FAIL: second idempotent call %',x;END IF;
END $case$;
RESET ROLE;

DO $assert$
DECLARE
 c record;
 s record;
BEGIN
  IF (SELECT count(*) FROM public.candidates)<>1
     OR (SELECT count(*) FROM public.submissions)<>1 THEN
     RAISE EXCEPTION 'Build105 FAIL: initial commit created duplicate rows';
  END IF;
  SELECT * INTO c FROM public.candidates;
  SELECT * INTO s FROM public.submissions;
  IF c.candidate_code NOT LIKE 'CAND-%'
    OR c.stage IS DISTINCT FROM 'submitted_to_client'
    OR c.status IS DISTINCT FROM 'active'
    OR s.candidate_id IS DISTINCT FROM c.id
    OR s.candidate_uuid IS DISTINCT FROM c.id
    OR s.job_uuid IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'::uuid
    OR s.job_id IS DISTINCT FROM s.job_uuid
  THEN RAISE EXCEPTION 'Build105 FAIL: production-derived candidate/submission triggers incompatible';END IF;
  IF (SELECT count(*) FROM public.candidate_stage_history WHERE candidate_id=c.id AND new_stage='submitted_to_client')<>1 THEN
    RAISE EXCEPTION 'Build105 FAIL: production stage-history trigger failed';
  END IF;
  IF (SELECT count(*) FROM public.submissions WHERE candidate_uuid=c.id)<>1 THEN
    RAISE EXCEPTION 'Build105 FAIL: source submission stage change spawned duplicate submission';
  END IF;
  IF (SELECT count(*) FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Build105 FAIL: proof not consumed exactly once';
  END IF;
END $assert$;

-- Source-derived trigger runs BEFORE and AFTER submission; a later failure
-- must roll back the candidate, submission, stage-history and proof update.
CREATE FUNCTION public.b105_reject_submission() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
  IF NEW.remarks='SIMULATE_FAILURE' THEN
    RAISE EXCEPTION 'synthetic post-submission failure';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER zz_b105_fail AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.b105_reject_submission();

SET LOCAL ROLE service_role;
DO $cases$
DECLARE has_error boolean; x text;
BEGIN
  has_error:=false;
  BEGIN
    PERFORM public.crm_commit_verified_public_application(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      '11111111-1111-4111-8111-111111111111',
      'Synthetic Applicant 2','synthetic2@example.invalid','9876543211',
      NULL,NULL,NULL,NULL,NULL,'SIMULATE_FAILURE');
  EXCEPTION WHEN OTHERS THEN has_error:=true;END;
  IF NOT has_error THEN RAISE EXCEPTION 'Build105 FAIL: trigger error accepted'; END IF;

  has_error:=false;
  BEGIN
    PERFORM public.crm_commit_verified_public_application(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '11111111-1111-4111-8111-111111111111',
      'Synthetic Applicant 3','synthetic3@example.invalid','9876543212');
  EXCEPTION WHEN OTHERS THEN has_error:=true;END;
  IF NOT has_error THEN RAISE EXCEPTION 'Build105 FAIL: expired proof accepted'; END IF;

  has_error:=false;
  BEGIN
    PERFORM public.crm_commit_verified_public_application(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      '22222222-2222-4222-8222-222222222222',
      'Synthetic Applicant 4','synthetic4@example.invalid','9876543213');
  EXCEPTION WHEN OTHERS THEN has_error:=true;END;
  IF NOT has_error THEN RAISE EXCEPTION 'Build105 FAIL: closed posting accepted'; END IF;

  has_error:=false;
  BEGIN
    PERFORM public.crm_commit_verified_public_application(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
      '11111111-1111-4111-8111-111111111111',
      'Synthetic Applicant 5','synthetic1@example.invalid','9876543214');
  EXCEPTION WHEN OTHERS THEN has_error:=true;END;
  IF NOT has_error THEN RAISE EXCEPTION 'Build105 FAIL: existing candidate email reused'; END IF;
END $cases$;
RESET ROLE;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.candidates)<>1
    OR (SELECT count(*) FROM public.submissions)<>1
    OR (SELECT count(*) FROM public.candidate_stage_history)<>1
    OR (SELECT count(*) FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL)<>1 THEN
      RAISE EXCEPTION 'Build105 FAIL: failed transactions left candidate/submission/history/proof side effects';
  END IF;
END $verify$;

-- Test never commits, including all synthetic role/schema/function definitions.
ROLLBACK;
