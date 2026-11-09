-- DISPOSABLE POSTGRES ONLY. Uses production-verified column names/types for candidates,
-- profiles and billing, but deliberately reduces the schema and view definitions.
BEGIN;
CREATE ROLE build2_realshape_user NOLOGIN;
CREATE SCHEMA build2_realshape;
CREATE SCHEMA build2_realshape_auth;
CREATE TYPE build2_realshape.candidate_stage AS ENUM ('new','placed');
CREATE TYPE build2_realshape.user_status AS ENUM ('pending','approved');
CREATE FUNCTION build2_realshape_auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT NULLIF(current_setting('build2_realshape.uid',true),'')::uuid $$;
CREATE TABLE build2_realshape.profiles (
 id uuid PRIMARY KEY,full_name text NOT NULL,email text NOT NULL,
 status build2_realshape.user_status NOT NULL,is_active boolean NOT NULL
);
CREATE TABLE build2_realshape.candidates (
 id uuid PRIMARY KEY,candidate_code text,full_name text NOT NULL,
 assigned_recruiter uuid,stage build2_realshape.candidate_stage NOT NULL,
 created_by uuid, status text NOT NULL
);
CREATE TABLE build2_realshape.billing (
 id uuid PRIMARY KEY,candidate_id uuid,client_id uuid,salary numeric,
 placement_fee numeric,gst numeric,invoice_amount numeric,outstanding_amount numeric
);
INSERT INTO build2_realshape.profiles VALUES
 ('11111111-1111-1111-1111-111111111111','Recruiter A','a@example.invalid','approved',true),
 ('22222222-2222-2222-2222-222222222222','Recruiter B','b@example.invalid','approved',true),
 ('33333333-3333-3333-3333-333333333333','Inactive','inactive@example.invalid','approved',false);
INSERT INTO build2_realshape.candidates VALUES
 ('00000000-0000-0000-0000-000000000001','SYN-A','Candidate A','11111111-1111-1111-1111-111111111111','new',null,'active'),
 ('00000000-0000-0000-0000-000000000002','SYN-B','Candidate B','22222222-2222-2222-2222-222222222222','placed',null,'active');
INSERT INTO build2_realshape.billing VALUES
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',null,100,10,2,12,12);
ALTER TABLE build2_realshape.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_realshape.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_realshape.billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_read ON build2_realshape.candidates FOR SELECT TO build2_realshape_user
 USING (assigned_recruiter=build2_realshape_auth.uid() AND EXISTS
 (SELECT 1 FROM build2_realshape.profiles p WHERE p.id=build2_realshape_auth.uid()
 AND p.status='approved' AND p.is_active));
CREATE POLICY profile_self ON build2_realshape.profiles FOR SELECT TO build2_realshape_user
 USING (id=build2_realshape_auth.uid());
CREATE VIEW build2_realshape.vw_candidate_filters WITH (security_invoker=true) AS
 SELECT id,candidate_code,full_name,assigned_recruiter FROM build2_realshape.candidates;
CREATE VIEW build2_realshape.vw_billing_filters WITH (security_invoker=true) AS
 SELECT id,salary,placement_fee,gst,outstanding_amount FROM build2_realshape.billing;
GRANT USAGE ON SCHEMA build2_realshape,build2_realshape_auth TO build2_realshape_user;
REVOKE EXECUTE ON FUNCTION build2_realshape_auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build2_realshape_auth.uid() TO build2_realshape_user;
GRANT SELECT ON build2_realshape.profiles,build2_realshape.candidates,
 build2_realshape.vw_candidate_filters TO build2_realshape_user;
COMMIT;
DO $$
BEGIN
 IF has_table_privilege('build2_realshape_user','build2_realshape.vw_billing_filters','SELECT')
 THEN RAISE EXCEPTION 'financial view accessible to recruiter'; END IF;
END $$;
SET ROLE build2_realshape_user;
SET build2_realshape.uid='11111111-1111-1111-1111-111111111111';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM build2_realshape.vw_candidate_filters;
 IF n<>1 THEN RAISE EXCEPTION 'A expected one candidate, got %',n; END IF;
 IF EXISTS (SELECT 1 FROM build2_realshape.vw_candidate_filters WHERE candidate_code='SYN-B')
 THEN RAISE EXCEPTION 'B candidate exposed to A'; END IF;
END $$;
SET build2_realshape.uid='33333333-3333-3333-3333-333333333333';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM build2_realshape.vw_candidate_filters;
 IF n<>0 THEN RAISE EXCEPTION 'inactive account exposed % candidates',n; END IF;
END $$;
RESET build2_realshape.uid;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM build2_realshape.vw_candidate_filters;
 IF n<>0 THEN RAISE EXCEPTION 'missing identity exposed % candidates',n; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: live-column-shaped candidate view denies cross-recruiter, inactive and missing-identity reads' AS result;
