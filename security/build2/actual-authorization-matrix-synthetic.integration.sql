-- 140 real SQL authorization probes against a SYNTHETIC POLICY MODEL.
-- No independent schema equivalence, no production role proof, no release gate effect.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE build2_case_authenticated NOLOGIN;
CREATE ROLE build2_case_admin NOLOGIN;
CREATE ROLE build2_case_anon NOLOGIN;
CREATE ROLE build2_case_integration NOLOGIN;
CREATE SCHEMA build2_case;
CREATE FUNCTION build2_case.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('build2_case.uid',true),'')::uuid $$;
CREATE TABLE build2_case.actors(id uuid PRIMARY KEY,approved boolean NOT NULL,role text NOT NULL);
INSERT INTO build2_case.actors VALUES
 ('11111111-1111-1111-1111-111111111111',true,'recruiter'),
 ('22222222-2222-2222-2222-222222222222',false,'recruiter'),
 ('33333333-3333-3333-3333-333333333333',true,'recruiter'),
 ('44444444-4444-4444-4444-444444444444',true,'admin'),
 ('55555555-5555-5555-5555-555555555555',true,'finance'),
 ('66666666-6666-6666-6666-666666666666',true,'integration');
CREATE FUNCTION build2_case.approved() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=build2_case AS $$
 SELECT coalesce((SELECT approved FROM build2_case.actors WHERE id=build2_case.uid()),false) $$;
CREATE FUNCTION build2_case.has_role(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=build2_case AS $$
 SELECT build2_case.approved() AND EXISTS
 (SELECT 1 FROM build2_case.actors WHERE id=build2_case.uid() AND role=target) $$;
CREATE TABLE build2_case.candidates(
 id uuid PRIMARY KEY,assigned_recruiter uuid NOT NULL,stage text,position_applied text,confidential_text text);
CREATE TABLE build2_case.stage_history(id uuid PRIMARY KEY,candidate_id uuid NOT NULL,stage text);
CREATE TABLE build2_case.billing(id uuid PRIMARY KEY,payment_status text);
CREATE TABLE build2_case.profiles(id uuid PRIMARY KEY,status text NOT NULL);
CREATE TABLE build2_case.user_roles(user_id uuid PRIMARY KEY,role text NOT NULL);
INSERT INTO build2_case.candidates VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','lead_received','ORIGINAL','synthetic secret'),
 ('aaaaaaaa-0000-0000-0000-000000000002','77777777-7777-7777-7777-777777777777','lead_received','ORIGINAL','synthetic secret'),
 ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','lead_received','ORIGINAL','synthetic secret');
INSERT INTO build2_case.stage_history VALUES
 ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','contacted');
INSERT INTO build2_case.billing VALUES('bbbbbbbb-0000-0000-0000-000000000001','unpaid');
INSERT INTO build2_case.profiles VALUES('22222222-2222-2222-2222-222222222222','pending');
INSERT INTO build2_case.user_roles VALUES
 ('11111111-1111-1111-1111-111111111111','recruiter'),
 ('33333333-3333-3333-3333-333333333333','recruiter'),
 ('44444444-4444-4444-4444-444444444444','admin');
ALTER TABLE build2_case.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_case.stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_case.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_case.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE build2_case.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY can_read_candidate ON build2_case.candidates FOR SELECT TO build2_case_authenticated,build2_case_admin
 USING(build2_case.approved() AND
 (build2_case.has_role('admin') OR (build2_case.has_role('recruiter') AND assigned_recruiter=build2_case.uid())));
CREATE POLICY can_insert_candidate ON build2_case.candidates FOR INSERT TO build2_case_authenticated,build2_case_admin
 WITH CHECK(build2_case.approved() AND
 (build2_case.has_role('admin') OR (build2_case.has_role('recruiter') AND assigned_recruiter=build2_case.uid())));
CREATE POLICY can_update_candidate ON build2_case.candidates FOR UPDATE TO build2_case_authenticated,build2_case_admin
 USING(build2_case.approved() AND
 (build2_case.has_role('admin') OR (build2_case.has_role('recruiter') AND assigned_recruiter=build2_case.uid())))
 WITH CHECK(build2_case.approved() AND
 (build2_case.has_role('admin') OR (build2_case.has_role('recruiter') AND assigned_recruiter=build2_case.uid())));
CREATE POLICY can_delete_candidate ON build2_case.candidates FOR DELETE TO build2_case_admin USING(build2_case.has_role('admin'));
CREATE POLICY can_read_history ON build2_case.stage_history FOR SELECT TO build2_case_authenticated,build2_case_admin
 USING(build2_case.has_role('admin') OR (build2_case.has_role('recruiter') AND EXISTS(
 SELECT 1 FROM build2_case.candidates c WHERE c.id=candidate_id AND c.assigned_recruiter=build2_case.uid())));
CREATE POLICY can_read_bill ON build2_case.billing FOR SELECT TO build2_case_authenticated,build2_case_admin
 USING(build2_case.has_role('admin') OR build2_case.has_role('finance'));
CREATE POLICY can_approve_user ON build2_case.profiles FOR UPDATE TO build2_case_admin
 USING(build2_case.has_role('admin')) WITH CHECK(build2_case.has_role('admin'));
CREATE POLICY can_select_user ON build2_case.profiles FOR SELECT TO build2_case_admin USING(build2_case.has_role('admin'));
GRANT USAGE ON SCHEMA build2_case TO build2_case_authenticated,build2_case_admin;
GRANT SELECT(id,assigned_recruiter,stage,position_applied),
 INSERT(id,assigned_recruiter,stage,position_applied),
 UPDATE(stage,position_applied) ON build2_case.candidates TO build2_case_authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON build2_case.candidates TO build2_case_admin;
GRANT SELECT ON build2_case.stage_history,build2_case.billing TO build2_case_authenticated,build2_case_admin;
GRANT SELECT,UPDATE(status) ON build2_case.profiles TO build2_case_admin;
GRANT SELECT ON build2_case.user_roles TO build2_case_admin;
CREATE VIEW build2_case.candidate_view WITH(security_invoker=true) AS
 SELECT id,assigned_recruiter,stage FROM build2_case.candidates;
GRANT SELECT ON build2_case.candidate_view TO build2_case_authenticated,build2_case_admin;
CREATE FUNCTION build2_case.admin_candidate_count(target uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=build2_case AS $$ SELECT count(*)::integer FROM build2_case.candidates WHERE id=target $$;
CREATE FUNCTION build2_case.activate_financial_workflow() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION build2_case.admin_candidate_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION build2_case.activate_financial_workflow() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build2_case.admin_candidate_count(uuid) TO build2_case_admin;
CREATE TABLE build2_case_results(id text PRIMARY KEY,expected text NOT NULL,actual text NOT NULL,role text NOT NULL,case_id text NOT NULL);

SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__anon','deny',current_setting('build2_case.observed'),'anon','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__recruiter_assigned','allow',current_setting('build2_case.observed'),'recruiter_assigned','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__admin','allow',current_setting('build2_case.observed'),'admin','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__finance','deny',current_setting('build2_case.observed'),'finance','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_assigned__integration','deny',current_setting('build2_case.observed'),'integration','candidate_read_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_assigned__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_assigned__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__anon','deny',current_setting('build2_case.observed'),'anon','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__admin','allow',current_setting('build2_case.observed'),'admin','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__finance','deny',current_setting('build2_case.observed'),'finance','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_read_other__integration','deny',current_setting('build2_case.observed'),'integration','candidate_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_read_other__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_read_other__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__anon','deny',current_setting('build2_case.observed'),'anon','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__recruiter_assigned','allow',current_setting('build2_case.observed'),'recruiter_assigned','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__admin','allow',current_setting('build2_case.observed'),'admin','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__finance','deny',current_setting('build2_case.observed'),'finance','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage,position_applied) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received','SYNTHETIC');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_create__integration','deny',current_setting('build2_case.observed'),'integration','candidate_create');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_create__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_create__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__anon','deny',current_setting('build2_case.observed'),'anon','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__recruiter_assigned','allow',current_setting('build2_case.observed'),'recruiter_assigned','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__admin','allow',current_setting('build2_case.observed'),'admin','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__finance','deny',current_setting('build2_case.observed'),'finance','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_assigned__integration','deny',current_setting('build2_case.observed'),'integration','candidate_update_assigned');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_assigned__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_assigned__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__anon','deny',current_setting('build2_case.observed'),'anon','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__admin','allow',current_setting('build2_case.observed'),'admin','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__finance','deny',current_setting('build2_case.observed'),'finance','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='PROBE' WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_update_other__integration','deny',current_setting('build2_case.observed'),'integration','candidate_update_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_update_other__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_update_other__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__anon','deny',current_setting('build2_case.observed'),'anon','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__admin','allow',current_setting('build2_case.observed'),'admin','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__finance','deny',current_setting('build2_case.observed'),'finance','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  DELETE FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_delete__integration','deny',current_setting('build2_case.observed'),'integration','candidate_delete');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_delete__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_delete__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__anon','deny',current_setting('build2_case.observed'),'anon','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__admin','allow',current_setting('build2_case.observed'),'admin','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__finance','deny',current_setting('build2_case.observed'),'finance','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET assigned_recruiter='33333333-3333-3333-3333-333333333333' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_reassign__integration','deny',current_setting('build2_case.observed'),'integration','candidate_reassign');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_reassign__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_reassign__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__anon','deny',current_setting('build2_case.observed'),'anon','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__unapproved','deny',current_setting('build2_case.observed'),'unapproved','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__admin','allow',current_setting('build2_case.observed'),'admin','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__finance','deny',current_setting('build2_case.observed'),'finance','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM (SELECT confidential_text FROM build2_case.candidates WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid) q WHERE q.confidential_text IS NOT NULL;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('confidential_column_read__integration','deny',current_setting('build2_case.observed'),'integration','confidential_column_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='confidential_column_read__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','confidential_column_read__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__anon','deny',current_setting('build2_case.observed'),'anon','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__recruiter_assigned','allow',current_setting('build2_case.observed'),'recruiter_assigned','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__admin','allow',current_setting('build2_case.observed'),'admin','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__finance','deny',current_setting('build2_case.observed'),'finance','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET stage='interview_scheduled' WHERE id='aaaaaaaa-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_stage_change__integration','deny',current_setting('build2_case.observed'),'integration','candidate_stage_change');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_stage_change__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_stage_change__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__anon','deny',current_setting('build2_case.observed'),'anon','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__recruiter_assigned','allow',current_setting('build2_case.observed'),'recruiter_assigned','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__admin','allow',current_setting('build2_case.observed'),'admin','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__finance','deny',current_setting('build2_case.observed'),'finance','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.candidates SET position_applied='BULK' WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid);
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=2 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_bulk_update__integration','deny',current_setting('build2_case.observed'),'integration','candidate_bulk_update');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_bulk_update__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_bulk_update__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__anon','deny',current_setting('build2_case.observed'),'anon','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__admin','allow',current_setting('build2_case.observed'),'admin','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__finance','deny',current_setting('build2_case.observed'),'finance','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_view_read_other__integration','deny',current_setting('build2_case.observed'),'integration','candidate_view_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_view_read_other__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_view_read_other__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__anon','deny',current_setting('build2_case.observed'),'anon','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__unapproved','deny',current_setting('build2_case.observed'),'unapproved','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__admin','allow',current_setting('build2_case.observed'),'admin','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__finance','deny',current_setting('build2_case.observed'),'finance','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.admin_candidate_count('aaaaaaaa-0000-0000-0000-000000000002'::uuid) INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('candidate_rpc_other__integration','deny',current_setting('build2_case.observed'),'integration','candidate_rpc_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='candidate_rpc_other__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','candidate_rpc_other__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__anon','deny',current_setting('build2_case.observed'),'anon','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__unapproved','deny',current_setting('build2_case.observed'),'unapproved','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__admin','allow',current_setting('build2_case.observed'),'admin','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__finance','deny',current_setting('build2_case.observed'),'finance','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.stage_history WHERE candidate_id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('stage_history_read_other__integration','deny',current_setting('build2_case.observed'),'integration','stage_history_read_other');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='stage_history_read_other__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','stage_history_read_other__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__anon','deny',current_setting('build2_case.observed'),'anon','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__unapproved','deny',current_setting('build2_case.observed'),'unapproved','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__admin','allow',current_setting('build2_case.observed'),'admin','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__finance','allow',current_setting('build2_case.observed'),'finance','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.billing WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_read__integration','deny',current_setting('build2_case.observed'),'integration','billing_read');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_read__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_read__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__anon','deny',current_setting('build2_case.observed'),'anon','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__unapproved','deny',current_setting('build2_case.observed'),'unapproved','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__admin','deny',current_setting('build2_case.observed'),'admin','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__finance','deny',current_setting('build2_case.observed'),'finance','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.billing SET payment_status='paid' WHERE id='bbbbbbbb-0000-0000-0000-000000000001'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('billing_mutate__integration','deny',current_setting('build2_case.observed'),'integration','billing_mutate');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='billing_mutate__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','billing_mutate__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__anon','deny',current_setting('build2_case.observed'),'anon','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__unapproved','deny',current_setting('build2_case.observed'),'unapproved','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__admin','deny',current_setting('build2_case.observed'),'admin','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__finance','deny',current_setting('build2_case.observed'),'finance','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT build2_case.activate_financial_workflow() INTO n;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('workflow_financial_trigger__integration','deny',current_setting('build2_case.observed'),'integration','workflow_financial_trigger');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='workflow_financial_trigger__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','workflow_financial_trigger__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__anon','deny',current_setting('build2_case.observed'),'anon','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__unapproved','deny',current_setting('build2_case.observed'),'unapproved','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__admin','allow',current_setting('build2_case.observed'),'admin','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__finance','deny',current_setting('build2_case.observed'),'finance','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.profiles SET status='approved' WHERE id='22222222-2222-2222-2222-222222222222'::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_approval__integration','deny',current_setting('build2_case.observed'),'integration','role_approval');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_approval__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_approval__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__anon','deny',current_setting('build2_case.observed'),'anon','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__unapproved','deny',current_setting('build2_case.observed'),'unapproved','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__admin','deny',current_setting('build2_case.observed'),'admin','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__finance','deny',current_setting('build2_case.observed'),'finance','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  UPDATE build2_case.user_roles SET role='admin' WHERE user_id=build2_case.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('role_escalation__integration','deny',current_setting('build2_case.observed'),'integration','role_escalation');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='role_escalation__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','role_escalation__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__anon','deny',current_setting('build2_case.observed'),'anon','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__unapproved','deny',current_setting('build2_case.observed'),'unapproved','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__admin','allow',current_setting('build2_case.observed'),'admin','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__finance','deny',current_setting('build2_case.observed'),'finance','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM build2_case.candidate_view WHERE id='aaaaaaaa-0000-0000-0000-000000000002'::uuid;
 
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('unauthenticated_view__integration','deny',current_setting('build2_case.observed'),'integration','unauthenticated_view');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='unauthenticated_view__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','unauthenticated_view__integration'; END IF;
END $assert$;
SET ROLE build2_case_anon;
SELECT set_config('build2_case.uid','',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__anon','deny',current_setting('build2_case.observed'),'anon','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__anon') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__anon'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','22222222-2222-2222-2222-222222222222',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__unapproved','deny',current_setting('build2_case.observed'),'unapproved','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__unapproved') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__unapproved'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','11111111-1111-1111-1111-111111111111',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__recruiter_assigned','deny',current_setting('build2_case.observed'),'recruiter_assigned','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__recruiter_assigned') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__recruiter_assigned'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','33333333-3333-3333-3333-333333333333',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__recruiter_other','deny',current_setting('build2_case.observed'),'recruiter_other','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__recruiter_other') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__recruiter_other'; END IF;
END $assert$;
SET ROLE build2_case_admin;
SELECT set_config('build2_case.uid','44444444-4444-4444-4444-444444444444',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__admin','deny',current_setting('build2_case.observed'),'admin','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__admin') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__admin'; END IF;
END $assert$;
SET ROLE build2_case_authenticated;
SELECT set_config('build2_case.uid','55555555-5555-5555-5555-555555555555',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__finance','deny',current_setting('build2_case.observed'),'finance','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__finance') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__finance'; END IF;
END $assert$;
SET ROLE build2_case_integration;
SELECT set_config('build2_case.uid','66666666-6666-6666-6666-666666666666',false);
DO $probe$
DECLARE n integer:=0; observed text:='deny';
BEGIN
 BEGIN
  INSERT INTO build2_case.candidates(id,assigned_recruiter,stage) VALUES ('aaaaaaaa-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','lead_received');
 GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN observed:='allow'; END IF;
  RAISE EXCEPTION 'probe rollback' USING ERRCODE='PZ001';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  WHEN insufficient_privilege THEN observed:='deny';
 END;
 PERFORM set_config('build2_case.observed',observed,false);
END $probe$;
RESET ROLE;
INSERT INTO build2_case_results VALUES ('integration_candidate_write__integration','deny',current_setting('build2_case.observed'),'integration','integration_candidate_write');
DO $assert$
BEGIN
 IF (SELECT actual<>expected FROM build2_case_results WHERE id='integration_candidate_write__integration') THEN
 RAISE EXCEPTION 'Authorization mismatch: %','integration_candidate_write__integration'; END IF;
END $assert$;

DO $final$
BEGIN
 IF (SELECT count(*) FROM build2_case_results)<>140 THEN RAISE EXCEPTION 'Expected 140 SQL probes'; END IF;
 IF EXISTS(SELECT 1 FROM build2_case_results WHERE actual<>expected) THEN RAISE EXCEPTION 'Matrix outcome mismatch'; END IF;
END $final$;
\copy (SELECT row_to_json(t) FROM (SELECT id,case_id,role,expected,actual FROM build2_case_results ORDER BY id) t) TO '/tmp/build2-auth-synthetic-observations.ndjson'
SELECT 'PASS: 140/140 SQL operations match synthetic provisional policy MODEL only; no schema equivalence' AS result;
ROLLBACK;
