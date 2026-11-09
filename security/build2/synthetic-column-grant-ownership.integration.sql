-- Disposable PostgreSQL 17: prove column-level UPDATE grants block owner changes
-- independently of RLS. Does not modify production or approve any role policy.
BEGIN;
CREATE ROLE build2_column_recruiter NOLOGIN;
CREATE SCHEMA build2_columns;
CREATE FUNCTION build2_columns.uid() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT current_setting('build2_columns.uid', true) $$;
CREATE TABLE build2_columns.candidates (
 id integer PRIMARY KEY, assigned_recruiter text NOT NULL,
 stage text NOT NULL, status text NOT NULL
);
INSERT INTO build2_columns.candidates VALUES
 (1,'recruiter-A','lead_received','active'),
 (2,'recruiter-B','lead_received','active');
ALTER TABLE build2_columns.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON build2_columns.candidates FOR SELECT TO build2_column_recruiter
 USING(assigned_recruiter=build2_columns.uid());
CREATE POLICY owner_update ON build2_columns.candidates FOR UPDATE TO build2_column_recruiter
 USING(assigned_recruiter=build2_columns.uid())
 WITH CHECK(assigned_recruiter=build2_columns.uid());
GRANT USAGE ON SCHEMA build2_columns TO build2_column_recruiter;
GRANT EXECUTE ON FUNCTION build2_columns.uid() TO build2_column_recruiter;
GRANT SELECT ON build2_columns.candidates TO build2_column_recruiter;
GRANT UPDATE(stage,status) ON build2_columns.candidates TO build2_column_recruiter;
COMMIT;
DO $assert$
BEGIN
 IF has_column_privilege('build2_column_recruiter','build2_columns.candidates','assigned_recruiter','UPDATE')
 THEN RAISE EXCEPTION 'recruiter can change ownership'; END IF;
 IF NOT has_column_privilege('build2_column_recruiter','build2_columns.candidates','stage','UPDATE')
 THEN RAISE EXCEPTION 'recruiter cannot change stage'; END IF;
END $assert$;
SET ROLE build2_column_recruiter;
SET build2_columns.uid='recruiter-A';
DO $assert$
DECLARE got_rejection boolean:=false;
BEGIN
 BEGIN
 UPDATE build2_columns.candidates SET assigned_recruiter='recruiter-A' WHERE id=1;
 EXCEPTION WHEN insufficient_privilege THEN got_rejection:=true;
 END;
 IF NOT got_rejection THEN RAISE EXCEPTION 'column-level ownership update unexpectedly permitted'; END IF;
END $assert$;
UPDATE build2_columns.candidates SET stage='screening' WHERE id=1;
DO $assert$
DECLARE affected integer;
BEGIN
 UPDATE build2_columns.candidates SET stage='screening' WHERE id=2;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'cross-owner update affected % rows',affected; END IF;
END $assert$;
RESET ROLE;
DO $assert$
BEGIN
 IF (SELECT stage FROM build2_columns.candidates WHERE id=1)<>'screening'
 OR (SELECT assigned_recruiter FROM build2_columns.candidates WHERE id=1)<>'recruiter-A'
 OR (SELECT stage FROM build2_columns.candidates WHERE id=2)<>'lead_received'
 THEN RAISE EXCEPTION 'column grants/RLS failed to preserve ownership and isolation'; END IF;
END $assert$;
SELECT 'PASS: column-level grants prevent recruiter ownership edits while RLS permits own stage and blocks other rows' AS result;
