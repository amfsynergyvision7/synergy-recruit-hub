-- ISOLATED TEST ONLY: realistic synthetic aggregate view privilege and RLS regression.
-- Does not reproduce the full live CRM schema or the 13 production view definitions.
BEGIN;
CREATE ROLE build2_report_anon NOLOGIN;
CREATE ROLE build2_report_authenticated NOLOGIN;
CREATE SCHEMA build2_report;
CREATE SCHEMA build2_report_auth;
CREATE FUNCTION build2_report_auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('build2_report.uid',true),'')::uuid $$;
CREATE TABLE build2_report.candidates(
 id integer PRIMARY KEY,
 recruiter_id uuid NOT NULL,
 stage text NOT NULL,
 salary numeric NOT NULL
);
INSERT INTO build2_report.candidates VALUES
 (1,'11111111-1111-1111-1111-111111111111','placed',100),
 (2,'11111111-1111-1111-1111-111111111111','new',200),
 (3,'22222222-2222-2222-2222-222222222222','placed',900);
ALTER TABLE build2_report.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY recruiter_read ON build2_report.candidates FOR SELECT TO build2_report_authenticated
 USING (recruiter_id=build2_report_auth.uid());
CREATE VIEW build2_report.recruiter_performance WITH (security_invoker=true) AS
 SELECT recruiter_id,count(*) AS candidate_count,
 count(*) FILTER (WHERE stage='placed') AS placed_count
 FROM build2_report.candidates GROUP BY recruiter_id;
CREATE VIEW build2_report.billing_filter WITH (security_invoker=true) AS
 SELECT id,salary FROM build2_report.candidates;
GRANT USAGE ON SCHEMA build2_report,build2_report_auth TO build2_report_authenticated;
REVOKE ALL ON FUNCTION build2_report_auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build2_report_auth.uid() TO build2_report_authenticated;
GRANT SELECT ON build2_report.candidates,build2_report.recruiter_performance TO build2_report_authenticated;
REVOKE ALL ON build2_report.recruiter_performance,build2_report.billing_filter FROM PUBLIC,build2_report_anon;
COMMIT;
DO $$
BEGIN
 IF has_table_privilege('build2_report_anon','build2_report.recruiter_performance','SELECT')
 THEN RAISE EXCEPTION 'anonymous performance access exposed'; END IF;
 IF has_table_privilege('build2_report_authenticated','build2_report.billing_filter','SELECT')
 THEN RAISE EXCEPTION 'unauthorized salary filter exposed'; END IF;
END $$;
SET ROLE build2_report_authenticated;
SET build2_report.uid='11111111-1111-1111-1111-111111111111';
DO $$
DECLARE n integer; total bigint; placed bigint;
BEGIN
 SELECT count(*),coalesce(sum(candidate_count),0),coalesce(sum(placed_count),0)
 INTO n,total,placed FROM build2_report.recruiter_performance;
 IF n<>1 OR total<>2 OR placed<>1
 THEN RAISE EXCEPTION 'recruiter A aggregate leakage or missing data: %,%,%',n,total,placed; END IF;
END $$;
SET build2_report.uid='22222222-2222-2222-2222-222222222222';
DO $$
DECLARE n integer; total bigint; placed bigint;
BEGIN
 SELECT count(*),coalesce(sum(candidate_count),0),coalesce(sum(placed_count),0)
 INTO n,total,placed FROM build2_report.recruiter_performance;
 IF n<>1 OR total<>1 OR placed<>1
 THEN RAISE EXCEPTION 'recruiter B aggregate leakage or missing data: %,%,%',n,total,placed; END IF;
END $$;
RESET build2_report.uid;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM build2_report.recruiter_performance;
 IF n<>0 THEN RAISE EXCEPTION 'unauthenticated aggregate leaked % groups',n; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: synthetic invoker aggregate view respects recruiter RLS and billing grant denial' AS result;
