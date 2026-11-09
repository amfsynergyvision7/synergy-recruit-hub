-- ISOLATED TEST FIXTURE ONLY: anonymous and authenticated RPC privilege regression.
-- This synthetic fixture does not recreate or modify any real CRM function.
BEGIN;
CREATE ROLE build2_anon NOLOGIN;
CREATE ROLE build2_authenticated NOLOGIN;
CREATE SCHEMA build2_rpc_test;
CREATE FUNCTION build2_rpc_test.resolver(p_id uuid) RETURNS uuid
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p_id $$;
CREATE FUNCTION build2_rpc_test.internal_job() RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
-- PostgreSQL grants EXECUTE to PUBLIC by default. An anon-specific revoke
-- without a PUBLIC revoke is ineffective.
DO $$
BEGIN
 IF NOT has_function_privilege('build2_anon','build2_rpc_test.resolver(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'expected default PUBLIC EXECUTE on resolver'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION build2_rpc_test.resolver(uuid) FROM PUBLIC,build2_anon;
REVOKE EXECUTE ON FUNCTION build2_rpc_test.internal_job() FROM PUBLIC,build2_anon,build2_authenticated;
GRANT USAGE ON SCHEMA build2_rpc_test TO build2_authenticated;
GRANT EXECUTE ON FUNCTION build2_rpc_test.resolver(uuid) TO build2_authenticated;
COMMIT;
DO $$
BEGIN
 IF has_function_privilege('build2_anon','build2_rpc_test.resolver(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'anonymous resolver execution remains available'; END IF;
 IF has_function_privilege('build2_anon','build2_rpc_test.internal_job()','EXECUTE')
 THEN RAISE EXCEPTION 'anonymous internal job execution remains available'; END IF;
 IF has_function_privilege('build2_authenticated','build2_rpc_test.internal_job()','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated internal job execution remains available'; END IF;
 IF NOT has_function_privilege('build2_authenticated','build2_rpc_test.resolver(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'authenticated resolver execution unexpectedly denied'; END IF;
END $$;
SELECT 'PASS: synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC' AS result;
