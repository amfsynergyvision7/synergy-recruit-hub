-- Synthetic-only constraint rehearsal; no original migration replay or billing activation.
BEGIN;
CREATE TEMP TABLE integrity_candidates (id uuid PRIMARY KEY);
CREATE TEMP TABLE integrity_interviews (id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES integrity_candidates(id));
CREATE TEMP TABLE integrity_offers (
 id uuid PRIMARY KEY,
 interview_uuid uuid UNIQUE REFERENCES integrity_interviews(id) ON DELETE SET NULL
);
CREATE TEMP TABLE integrity_billing (
 id uuid PRIMARY KEY,
 offer_uuid uuid UNIQUE REFERENCES integrity_offers(id) ON DELETE SET NULL
);
INSERT INTO integrity_candidates VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO integrity_interviews VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001');
INSERT INTO integrity_offers VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011');
INSERT INTO integrity_billing VALUES ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000021');
DO $integrity$
BEGIN
 BEGIN
  INSERT INTO integrity_offers VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011');
  RAISE EXCEPTION 'duplicate offer link unexpectedly accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO integrity_billing VALUES ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000021');
  RAISE EXCEPTION 'duplicate billing link unexpectedly accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO integrity_offers VALUES ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000099');
  RAISE EXCEPTION 'orphan interview reference unexpectedly accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO integrity_billing VALUES ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000099');
  RAISE EXCEPTION 'orphan offer reference unexpectedly accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM integrity_offers) <> 1 OR (SELECT count(*) FROM integrity_billing) <> 1 THEN
  RAISE EXCEPTION 'integrity violations modified synthetic rows';
 END IF;
END $integrity$;
DELETE FROM integrity_interviews WHERE id='00000000-0000-0000-0000-000000000011';
DO $integrity$
BEGIN
 IF (SELECT interview_uuid FROM integrity_offers LIMIT 1) IS NOT NULL THEN
  RAISE EXCEPTION 'ON DELETE SET NULL did not clear synthetic offer interview link';
 END IF;
END $integrity$;
DELETE FROM integrity_offers WHERE id='00000000-0000-0000-0000-000000000021';
DO $integrity$
BEGIN
 IF (SELECT offer_uuid FROM integrity_billing LIMIT 1) IS NOT NULL THEN
  RAISE EXCEPTION 'ON DELETE SET NULL did not clear synthetic billing offer link';
 END IF;
END $integrity$;
ROLLBACK;
SELECT 'PASS: synthetic duplicate-link, FK and delete semantics rolled back' AS result;
