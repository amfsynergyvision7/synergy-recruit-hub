-- Disposable PostgreSQL 17 ONLY: no hosted or production writes.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.job_openings(
  id uuid PRIMARY KEY,job_title text NOT NULL,status text,
  assigned_recruiter uuid
);
CREATE TABLE public.candidates(
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  full_name text NOT NULL,email text,mobile text,current_company text,
  experience_years numeric,expected_salary numeric,notice_period text,
  resume_url text,position_applied text,source text,assigned_recruiter uuid,
  stage text NOT NULL DEFAULT 'lead_received',status text NOT NULL DEFAULT 'active'
);
CREATE TABLE public.submissions(
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  candidate_uuid uuid REFERENCES public.candidates(id),
  job_uuid uuid REFERENCES public.job_openings(id),
  role_title text,status text,remarks text
);

INSERT INTO public.job_openings(id,job_title,status)
VALUES ('11111111-1111-4111-8111-111111111111','Synthetic Analyst','open'),
       ('22222222-2222-4222-8222-222222222222','Closed Role','closed');

\ir verified-public-application.review-only.sql

DO $test$
DECLARE
  fn text:='public.crm_commit_verified_public_application(uuid,uuid,text,text,text,text,numeric,numeric,text,text,text)';
BEGIN
  IF pg_catalog.has_function_privilege('anon',fn,'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated',fn,'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('service_role',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'Wrong public verified application RPC EXECUTE grants';
  END IF;
  IF pg_catalog.has_table_privilege('anon','crm_private.verified_public_applications','SELECT')
    OR pg_catalog.has_table_privilege('authenticated','crm_private.verified_public_applications','SELECT')
    OR pg_catalog.has_table_privilege('service_role','crm_private.verified_public_applications','SELECT')
    OR pg_catalog.has_table_privilege('service_role','crm_private.verified_public_applications','INSERT') THEN
      RAISE EXCEPTION 'Private proof ledger is readable/writable by API roles';
  END IF;
END $test$;

-- This is synthetic proof issuance in a disposable test fixture ONLY.
-- Production proof issuance must be implemented by a separate reviewed issuer.
INSERT INTO crm_private.verified_public_applications
 (proof_id,job_id,verified_email,verified_mobile,email_verified_at,mobile_verified_at,expires_at)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','person1@example.invalid','9876543210',
  pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','person2@example.invalid','9876543211',
  pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','11111111-1111-4111-8111-111111111111','person3@example.invalid','9876543212',
  pg_catalog.clock_timestamp()-interval '20 minutes',pg_catalog.clock_timestamp()-interval '20 minutes',pg_catalog.clock_timestamp()-interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','11111111-1111-4111-8111-111111111111','person4@example.invalid','9876543213',
  pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()+interval '5 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','22222222-2222-4222-8222-222222222222','person5@example.invalid','9876543214',
  pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()+interval '5 minutes');

SET LOCAL ROLE service_role;
DO $test$
DECLARE result text;
BEGIN
 SELECT public.crm_commit_verified_public_application(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 '11111111-1111-4111-8111-111111111111',
 'Synthetic One','PERSON1@EXAMPLE.INVALID','+91 9876543210',
 NULL,NULL,NULL,NULL,'https://drive.google.com/file/d/fictional/view')
 INTO result;
 IF result <> 'accepted' THEN RAISE EXCEPTION 'Expected first application to commit once';END IF;
 SELECT public.crm_commit_verified_public_application(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 '11111111-1111-4111-8111-111111111111',
 'Synthetic One','person1@example.invalid','9876543210')
 INTO result;
 IF result <> 'already_applied' THEN RAISE EXCEPTION 'Expected idempotent retry';END IF;
END $test$;
RESET ROLE;

DO $test$
BEGIN
 IF (SELECT pg_catalog.count(*) FROM public.candidates)<>1 OR
    (SELECT pg_catalog.count(*) FROM public.submissions)<>1 OR
    (SELECT pg_catalog.count(*) FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Atomic initial commit did not persist exactly one pair';
 END IF;
END $test$;

-- Build108 unsafe public resume URL must fail inside service-role RPC,
-- independently of TypeScript validation and without consuming a proof.
SET LOCAL ROLE service_role;
DO $unsafe_resume$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
   PERFORM public.crm_commit_verified_public_application(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic Two','person2@example.invalid','9876543211',
    NULL,NULL,NULL,NULL,'javascript:alert(1)');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Application unavailable' THEN RAISE; END IF;
   rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Build108 unsafe resume URL was accepted'; END IF;
END $unsafe_resume$;
RESET ROLE;
DO $unsafe_no_write$
BEGIN
 IF (SELECT count(*) FROM public.candidates)<>1 OR
    (SELECT count(*) FROM public.submissions)<>1 OR
    (SELECT count(*) FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL)<>1 THEN
   RAISE EXCEPTION 'Build108 unsafe resume URL caused candidate/submission/proof side effects';
 END IF;
END $unsafe_no_write$;

-- Synthetic AFTER/BEFORE trigger rejection simulates a real submission trigger
-- failure: a candidate cannot survive a failed submission in this RPC.
CREATE FUNCTION public.test_fail_submission() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF new.remarks='FAIL' THEN RAISE EXCEPTION 'simulated submissions trigger failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_reject_submission BEFORE INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.test_fail_submission();

SET LOCAL ROLE service_role;
DO $test$
DECLARE
  failed boolean:=false;
BEGIN
 BEGIN
  PERFORM public.crm_commit_verified_public_application(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
   '11111111-1111-4111-8111-111111111111',
   'Synthetic Two','person2@example.invalid','9876543211',
   NULL,NULL,NULL,NULL,NULL,'FAIL');
 EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Trigger failure must reject entire application';END IF;

 -- Expired proof never writes a candidate.
 failed:=false;
 BEGIN
  PERFORM public.crm_commit_verified_public_application(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   '11111111-1111-4111-8111-111111111111',
   'Synthetic Three','person3@example.invalid','9876543212');
 EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Expired proof accepted';END IF;

 -- Wrong contact should never consume proof or write records.
 failed:=false;
 BEGIN
  PERFORM public.crm_commit_verified_public_application(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
   '11111111-1111-4111-8111-111111111111',
   'Synthetic Four','attacker@example.invalid','9876543213');
 EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Tampered email accepted';END IF;

 -- Closed job must fail even when proof was previously valid.
 failed:=false;
 BEGIN
  PERFORM public.crm_commit_verified_public_application(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
   '22222222-2222-4222-8222-222222222222',
   'Synthetic Five','person5@example.invalid','9876543214');
 EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Closed job accepted';END IF;
END $test$;
RESET ROLE;

DO $test$
BEGIN
 IF (SELECT pg_catalog.count(*) FROM public.candidates)<>1 OR
    (SELECT pg_catalog.count(*) FROM public.submissions)<>1 OR
    (SELECT pg_catalog.count(*) FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'An unsuccessful application left an orphaned candidate or consumed proof';
 END IF;
END $test$;

-- No durable fixture rows/functions, even in the disposable test database.
ROLLBACK;
