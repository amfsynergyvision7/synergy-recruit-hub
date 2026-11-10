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

-- Synthetic selected-interview and joined-offer ambiguity: never choose arbitrary upstream links.
CREATE TEMP TABLE synthetic_selected_interviews (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL, status text NOT NULL
);
CREATE TEMP TABLE synthetic_offers (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL, interview_uuid uuid, joining_status text NOT NULL
);
CREATE TEMP TABLE synthetic_billing (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL, offer_uuid uuid
);
INSERT INTO synthetic_selected_interviews VALUES
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','selected'),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001','selected');
INSERT INTO synthetic_offers VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000001',NULL,'joined'),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000001',NULL,'joined');
INSERT INTO synthetic_billing VALUES
 ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000001',NULL);
DO $
BEGIN
 IF (SELECT count(*) FROM synthetic_offers o JOIN synthetic_selected_interviews i
 ON o.candidate_id=i.candidate_id AND i.status='selected'
 WHERE o.id='00000000-0000-0000-0000-000000000041')<>2
 THEN RAISE EXCEPTION 'Expected selected-interview ambiguity'; END IF;
 IF (SELECT count(*) FROM synthetic_billing b JOIN synthetic_offers o
 ON b.candidate_id=o.candidate_id AND o.joining_status='joined')<>2
 THEN RAISE EXCEPTION 'Expected joined-offer ambiguity'; END IF;
END $;
UPDATE synthetic_offers o SET interview_uuid=i.id
FROM synthetic_selected_interviews i
WHERE o.candidate_id=i.candidate_id AND i.status='selected'
AND 1=(SELECT count(*) FROM synthetic_selected_interviews x
 WHERE x.candidate_id=o.candidate_id AND x.status='selected');
UPDATE synthetic_billing b SET offer_uuid=o.id
FROM synthetic_offers o
WHERE b.candidate_id=o.candidate_id AND o.joining_status='joined'
AND 1=(SELECT count(*) FROM synthetic_offers x
 WHERE x.candidate_id=b.candidate_id AND x.joining_status='joined');
DO $
BEGIN
 IF EXISTS(SELECT 1 FROM synthetic_offers WHERE interview_uuid IS NOT NULL)
 OR EXISTS(SELECT 1 FROM synthetic_billing WHERE offer_uuid IS NOT NULL)
 THEN RAISE EXCEPTION 'Ambiguous offer or billing relationship assigned'; END IF;
END $;
DELETE FROM synthetic_selected_interviews WHERE id='00000000-0000-0000-0000-000000000032';
DELETE FROM synthetic_offers WHERE id='00000000-0000-0000-0000-000000000042';
UPDATE synthetic_offers o SET interview_uuid=i.id
FROM synthetic_selected_interviews i
WHERE o.candidate_id=i.candidate_id AND i.status='selected'
AND 1=(SELECT count(*) FROM synthetic_selected_interviews x
 WHERE x.candidate_id=o.candidate_id AND x.status='selected');
UPDATE synthetic_billing b SET offer_uuid=o.id
FROM synthetic_offers o
WHERE b.candidate_id=o.candidate_id AND o.joining_status='joined'
AND 1=(SELECT count(*) FROM synthetic_offers x
 WHERE x.candidate_id=b.candidate_id AND x.joining_status='joined');
DO $
BEGIN
 IF (SELECT interview_uuid FROM synthetic_offers LIMIT 1)<>'00000000-0000-0000-0000-000000000031'::uuid
 OR (SELECT offer_uuid FROM synthetic_billing LIMIT 1)<>'00000000-0000-0000-0000-000000000041'::uuid
 THEN RAISE EXCEPTION 'Unique offer or billing link not assigned'; END IF;
END $;

ROLLBACK;
SELECT 'PASS: synthetic ambiguous-match rejection and unique-match acceptance rolled back' AS result;
