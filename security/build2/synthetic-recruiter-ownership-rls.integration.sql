-- Disposable PostgreSQL 17 only: verify RLS ownership and zero-row UPDATE semantics.
-- Synthetic identity is session setting, not a real Supabase user.
BEGIN;
CREATE ROLE build2_owner_recruiter NOLOGIN;
CREATE SCHEMA build2_owner;
CREATE FUNCTION build2_owner.uid() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT current_setting('build2_owner.uid', true) $$;
CREATE TABLE build2_owner.candidates(id integer PRIMARY KEY, assigned_recruiter text NOT NULL, stage text NOT NULL);
INSERT INTO build2_owner.candidates VALUES(1,'recruiter-A','lead_received'),(2,'recruiter-B','lead_received');
ALTER TABLE build2_owner.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON build2_owner.candidates FOR SELECT TO build2_owner_recruiter
 USING(assigned_recruiter=build2_owner.uid());
CREATE POLICY own_update ON build2_owner.candidates FOR UPDATE TO build2_owner_recruiter
 USING(assigned_recruiter=build2_owner.uid())
 WITH CHECK(assigned_recruiter=build2_owner.uid());
GRANT USAGE ON SCHEMA build2_owner TO build2_owner_recruiter;
GRANT EXECUTE ON FUNCTION build2_owner.uid() TO build2_owner_recruiter;
GRANT SELECT,UPDATE ON build2_owner.candidates TO build2_owner_recruiter;
COMMIT;
SET ROLE build2_owner_recruiter;
SET build2_owner.uid='recruiter-A';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM build2_owner.candidates;
 IF n<>1 THEN RAISE EXCEPTION 'cross-owner SELECT exposed'; END IF;
END $check$;
DO $check$
DECLARE n integer;
BEGIN
 UPDATE build2_owner.candidates SET stage='screening' WHERE id=2;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'cross-owner UPDATE changed rows'; END IF;
END $check$;
DO $check$
BEGIN
 BEGIN
 UPDATE build2_owner.candidates SET assigned_recruiter='recruiter-B' WHERE id=1;
 RAISE EXCEPTION 'owner reassignment was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $check$;
UPDATE build2_owner.candidates SET stage='screening' WHERE id=1 RETURNING id;
RESET ROLE;
DO $check$
BEGIN
 IF (SELECT stage FROM build2_owner.candidates WHERE id=1)<>'screening'
 OR (SELECT assigned_recruiter FROM build2_owner.candidates WHERE id=1)<>'recruiter-A'
 OR (SELECT stage FROM build2_owner.candidates WHERE id=2)<>'lead_received'
 THEN RAISE EXCEPTION 'RLS allowed unauthorized mutation or blocked valid owner'; END IF;
END $check$;
SELECT 'PASS: synthetic recruiter RLS denies cross-owner reads/updates and reassignment; allows own stage update' AS result;
