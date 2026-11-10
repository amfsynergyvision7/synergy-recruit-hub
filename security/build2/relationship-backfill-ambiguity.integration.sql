-- Synthetic-only negative rehearsal for ambiguous joins in original relationship backfill.
-- This does not apply or modify the original migration and is not counted as a migration replay.
BEGIN;
CREATE TEMP TABLE synthetic_submissions (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL, client_id uuid NOT NULL, created_at timestamptz NOT NULL
);
CREATE TEMP TABLE synthetic_interviews (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL, client_id uuid NOT NULL, submission_uuid uuid
);
INSERT INTO synthetic_submissions VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','2026-01-01'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','2026-02-01');
INSERT INTO synthetic_interviews VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL);
DO $$
DECLARE matches integer;
BEGIN
 SELECT count(*) INTO matches
 FROM synthetic_interviews i JOIN synthetic_submissions s
 ON i.candidate_id=s.candidate_id AND i.client_id=s.client_id
 WHERE i.submission_uuid IS NULL;
 IF matches <> 2 THEN RAISE EXCEPTION 'Expected two matching synthetic submissions, got %',matches; END IF;
 RAISE NOTICE 'PASS: ambiguous original-style join has % candidate matches; do not automatically backfill',matches;
END $$;
-- Guarded deterministic alternative: assign only when exactly one upstream row matches.
UPDATE synthetic_interviews i SET submission_uuid=s.id
FROM synthetic_submissions s
WHERE i.candidate_id=s.candidate_id AND i.client_id=s.client_id
AND 1=(SELECT count(*) FROM synthetic_submissions c WHERE c.candidate_id=i.candidate_id AND c.client_id=i.client_id);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM synthetic_interviews WHERE submission_uuid IS NOT NULL)
 THEN RAISE EXCEPTION 'Ambiguous row was assigned despite guard'; END IF;
END $$;
DELETE FROM synthetic_submissions WHERE id='00000000-0000-0000-0000-000000000012';
UPDATE synthetic_interviews i SET submission_uuid=s.id
FROM synthetic_submissions s
WHERE i.candidate_id=s.candidate_id AND i.client_id=s.client_id
AND 1=(SELECT count(*) FROM synthetic_submissions c WHERE c.candidate_id=i.candidate_id AND c.client_id=i.client_id);
DO $$
BEGIN
 IF (SELECT submission_uuid FROM synthetic_interviews LIMIT 1)<>'00000000-0000-0000-0000-000000000011'::uuid
 THEN RAISE EXCEPTION 'Unique synthetic match not assigned'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: synthetic ambiguous-match rejection and unique-match acceptance rolled back' AS result;
