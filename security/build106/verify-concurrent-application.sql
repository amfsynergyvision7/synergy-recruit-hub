-- Build106: run ONLY after concurrent synthetic sessions completed in a
-- disposable PostgreSQL database. This file is a read-only assertion.
DO $verify$
DECLARE
 v_candidate_count bigint;
 v_submission_count bigint;
 v_history_count bigint;
 v_consumed_count bigint;
 v_existing_ids bigint;
BEGIN
 SELECT count(*) INTO v_candidate_count FROM public.candidates;
 SELECT count(*) INTO v_submission_count FROM public.submissions;
 SELECT count(*) INTO v_history_count FROM public.candidate_stage_history;
 SELECT count(*) INTO v_consumed_count
   FROM crm_private.verified_public_applications WHERE consumed_at IS NOT NULL;
 IF v_candidate_count<>3 OR v_submission_count<>3
     OR v_history_count<>3 OR v_consumed_count<>3 THEN
   RAISE EXCEPTION 'Build106 FAIL: concurrent proof claims left duplicate/orphan candidate, submission, stage history or proof';
 END IF;
 IF EXISTS(
  SELECT email FROM public.candidates GROUP BY email HAVING count(*)>1
 ) OR EXISTS(
  SELECT mobile FROM public.candidates GROUP BY mobile HAVING count(*)>1
 ) THEN
  RAISE EXCEPTION 'Build106 FAIL: concurrent claims inserted duplicate contact records';
 END IF;
 IF (SELECT count(*) FROM public.candidates
       WHERE stage='submitted_to_client' AND candidate_code LIKE 'CAND-%')<>3 THEN
  RAISE EXCEPTION 'Build106 FAIL: source-derived candidate triggers not exercised';
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.submissions s LEFT JOIN public.candidates c ON c.id=s.candidate_uuid
    WHERE c.id IS NULL OR s.candidate_id<>c.id OR s.job_uuid<>s.job_id
 ) THEN
   RAISE EXCEPTION 'Build106 FAIL: orphan or unnormalized submission';
 END IF;
 IF (SELECT count(*) FROM crm_private.verified_public_applications
     WHERE proof_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61' AND consumed_at IS NOT NULL)<>1 THEN
   RAISE EXCEPTION 'Build106 FAIL: same-proof idempotency ledger';
 END IF;
 IF (SELECT count(*) FROM crm_private.verified_public_applications
     WHERE proof_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa63') AND consumed_at IS NOT NULL)<>1 THEN
   RAISE EXCEPTION 'Build106 FAIL: distinct proofs sharing email';
 END IF;
 IF (SELECT count(*) FROM crm_private.verified_public_applications
     WHERE proof_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa64',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa65') AND consumed_at IS NOT NULL)<>1 THEN
   RAISE EXCEPTION 'Build106 FAIL: distinct proofs sharing phone';
 END IF;
END $verify$;
SELECT 'PASS: same-proof replay and different-proof duplicate contact claims are atomic; 3 candidate/submission/history/proof records' AS build106;
