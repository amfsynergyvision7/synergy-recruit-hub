-- Disposable PostgreSQL only. Reproduces the observed live SQL helper predicates
-- against synthetic profiles and roles, then exercises a proposed self-scoped RPC.
BEGIN;
CREATE ROLE build2_helper_anon NOLOGIN;
CREATE ROLE build2_helper_user NOLOGIN;
CREATE SCHEMA build2_helper;
CREATE SCHEMA build2_helper_auth;
CREATE TYPE build2_helper.app_role AS ENUM ('admin','recruiter','finance');
CREATE TYPE build2_helper.user_status AS ENUM ('approved','pending');
CREATE FUNCTION build2_helper_auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('build2_helper.uid',true),'')::uuid
$$;
CREATE TABLE build2_helper.profiles (
 id uuid PRIMARY KEY,status build2_helper.user_status NOT NULL,is_active boolean NOT NULL
);
CREATE TABLE build2_helper.user_roles (
 user_id uuid NOT NULL,role build2_helper.app_role NOT NULL
);
INSERT INTO build2_helper.profiles VALUES
 ('11111111-1111-1111-1111-111111111111','approved',true),
 ('22222222-2222-2222-2222-222222222222','pending',true),
 ('33333333-3333-3333-3333-333333333333','approved',false);
INSERT INTO build2_helper.user_roles VALUES
 ('11111111-1111-1111-1111-111111111111','recruiter'),
 ('22222222-2222-2222-2222-222222222222','admin'),
 ('33333333-3333-3333-3333-333333333333','admin');
CREATE FUNCTION build2_helper.is_approved(_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=build2_helper AS $$
 SELECT EXISTS(SELECT 1 FROM build2_helper.profiles
 WHERE id=_user_id AND status='approved' AND is_active=true)
$$;
CREATE FUNCTION build2_helper.has_role(_user_id uuid,_role build2_helper.app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=build2_helper AS $$
 SELECT EXISTS(SELECT 1 FROM build2_helper.user_roles WHERE user_id=_user_id AND role=_role)
$$;
-- Example proposed public RPC boundary: no arbitrary user identifier input.
CREATE FUNCTION build2_helper.my_approved_role(_role build2_helper.app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=build2_helper AS $$
 SELECT build2_helper_auth.uid() IS NOT NULL
 AND build2_helper.is_approved(build2_helper_auth.uid())
 AND build2_helper.has_role(build2_helper_auth.uid(),_role)
$$;
REVOKE ALL ON FUNCTION build2_helper.is_approved(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION build2_helper.has_role(uuid,build2_helper.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION build2_helper.my_approved_role(build2_helper.app_role) FROM PUBLIC;
GRANT USAGE ON SCHEMA build2_helper,build2_helper_auth TO build2_helper_user;
GRANT USAGE ON TYPE build2_helper.app_role TO build2_helper_user;
GRANT EXECUTE ON FUNCTION build2_helper.my_approved_role(build2_helper.app_role) TO build2_helper_user;
COMMIT;
DO $$
BEGIN
 IF has_function_privilege('build2_helper_anon','build2_helper.is_approved(uuid)','EXECUTE')
 OR has_function_privilege('build2_helper_anon','build2_helper.has_role(uuid,build2_helper.app_role)','EXECUTE')
 OR has_function_privilege('build2_helper_anon','build2_helper.my_approved_role(build2_helper.app_role)','EXECUTE')
 THEN RAISE EXCEPTION 'anon helper EXECUTE leaked'; END IF;
 IF has_function_privilege('build2_helper_user','build2_helper.has_role(uuid,build2_helper.app_role)','EXECUTE')
 THEN RAISE EXCEPTION 'arbitrary-ID role lookup exposed'; END IF;
 IF NOT build2_helper.is_approved('11111111-1111-1111-1111-111111111111')
 OR build2_helper.is_approved('22222222-2222-2222-2222-222222222222')
 OR build2_helper.is_approved('33333333-3333-3333-3333-333333333333')
 THEN RAISE EXCEPTION 'live helper predicate mismatch'; END IF;
END $$;
SET ROLE build2_helper_user;
SET build2_helper.uid='11111111-1111-1111-1111-111111111111';
DO $$
BEGIN
 IF NOT build2_helper.my_approved_role('recruiter')
 OR build2_helper.my_approved_role('admin')
 THEN RAISE EXCEPTION 'approved recruiter role mismatch'; END IF;
END $$;
SET build2_helper.uid='22222222-2222-2222-2222-222222222222';
DO $$
BEGIN
 IF build2_helper.my_approved_role('admin')
 THEN RAISE EXCEPTION 'pending admin unexpectedly approved'; END IF;
END $$;
SET build2_helper.uid='33333333-3333-3333-3333-333333333333';
DO $$
BEGIN
 IF build2_helper.my_approved_role('admin')
 THEN RAISE EXCEPTION 'inactive admin unexpectedly approved'; END IF;
END $$;
RESET build2_helper.uid;
DO $$
BEGIN
 IF build2_helper.my_approved_role('recruiter')
 THEN RAISE EXCEPTION 'missing identity unexpectedly approved'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: synthetic live helper predicates and self-scoped RPC deny pending, inactive, anonymous and arbitrary-ID access' AS result;
