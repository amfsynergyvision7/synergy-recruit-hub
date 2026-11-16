-- BUILD187 disposable PostgreSQL17 behavioral rehearsal: NEVER hosted.
-- The exact proposed DO-NOT-APPLY SQL is executed ONLY inside a rollback
-- transaction on a GitHub Actions ephemeral service, never on Supabase.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance');
CREATE TABLE public.user_roles(
 user_id uuid NOT NULL, role public.app_role NOT NULL,
 PRIMARY KEY (user_id,role));
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC,anon,authenticated;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111'::uuid,'admin'::public.app_role),
 ('22222222-2222-4222-8222-222222222222'::uuid,'recruiter'::public.app_role),
 ('33333333-3333-4333-8333-333333333333'::uuid,'finance'::public.app_role);
-- Fake auth.uid() reads a session GUC for this isolated test only.
-- This CANNOT prove Supabase GoTrue/JWT signature integrity.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 SECURITY INVOKER SET search_path=''
 AS $stub$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 $stub$;
-- Legacy function source copied structurally from production read-only catalog.
-- First verify the original broad anonymous exposure is reproducible.
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO public
 AS $legacy$
 SELECT EXISTS(SELECT 1 FROM public.user_roles
               WHERE user_id=_user_id AND role=_role)
 $legacy$;
SELECT (has_function_privilege('anon',
 'public.has_role(uuid,public.app_role)','EXECUTE')
 AND has_function_privilege('authenticated',
 'public.has_role(uuid,public.app_role)','EXECUTE')
) AS build187_legacy_exposure \gset
\if :build187_legacy_exposure
 \echo 'BUILD187_LEGACY_GRANT_EXPOSURE_REPRODUCED'
\else
 \echo 'BUILD187_FAIL: legacy fixture did not reproduce public access'
 SELECT 1/0;
\endif

-- Run exact separately proposed source under the SAME ephemeral transaction.
\i security/build187-role-helper/has-role-current-user.DO-NOT-APPLY.sql.txt

CREATE TABLE public.audit_probe(
 id uuid PRIMARY KEY, classification text NOT NULL);
CREATE TABLE public.candidate_probe(
 id uuid PRIMARY KEY, classification text NOT NULL);
INSERT INTO public.audit_probe VALUES
 ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fictional audit');
INSERT INTO public.candidate_probe VALUES
 ('ccccccc1-cccc-4ccc-8ccc-cccccccccccc','fictional candidate');
ALTER TABLE public.audit_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_probe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_probe FOR SELECT
 TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "candidate staff read" ON public.candidate_probe FOR SELECT
 TO authenticated USING (
 public.has_role(auth.uid(),'admin'::public.app_role) OR
 public.has_role(auth.uid(),'recruiter'::public.app_role));
GRANT SELECT ON public.audit_probe,public.candidate_probe TO authenticated;

-- Confirm fixed metadata. Policy runtime testing alone is not enough.
SELECT (
 NOT has_function_privilege('anon',
 'public.has_role(uuid,public.app_role)','EXECUTE')
 AND has_function_privilege('authenticated',
 'public.has_role(uuid,public.app_role)','EXECUTE')
 AND NOT has_table_privilege('authenticated','public.user_roles','SELECT')
 AND (SELECT p.prosecdef AND array_position(p.proconfig,'search_path=""') IS NOT NULL
  FROM pg_proc p WHERE p.oid=
   'public.has_role(uuid,public.app_role)'::regprocedure)
) AS build187_hardened_grants \gset
\if :build187_hardened_grants
 \echo 'BUILD187_EXPECTED_ROLE_GRANTS_AND_EMPTY_PATH'
\else
 \echo 'BUILD187_FAIL: role privileges or search path wrong'
 SELECT 1/0;
\endif

-- With a missing signed-in identity, even an authenticated DB role sees no
-- privileged result and no audit rows.
SET LOCAL ROLE authenticated;
SELECT (
 NOT public.has_role('11111111-1111-4111-8111-111111111111'::uuid,'admin'::public.app_role)
 AND (SELECT count(*) FROM public.audit_probe)=0
) AS build187_no_identity_denied \gset
\if :build187_no_identity_denied
 \echo 'BUILD187_NO_IDENTITY_DENIED'
\else
 \echo 'BUILD187_FAIL: missing identity was authorized'
 SELECT 1/0;
\endif

-- Admin: own role works, other people's roles cannot be enumerated,
-- and real RLS policy evaluation grants only the sample admin's audit read.
SELECT set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',true);
SELECT (
 public.has_role('11111111-1111-4111-8111-111111111111'::uuid,'admin'::public.app_role)
 AND NOT public.has_role('22222222-2222-4222-8222-222222222222'::uuid,'recruiter'::public.app_role)
 AND (SELECT count(*) FROM public.audit_probe)=1
 AND (SELECT count(*) FROM public.candidate_probe)=1
) AS build187_admin_session_correct \gset
\if :build187_admin_session_correct
 \echo 'BUILD187_ADMIN_SELF_SCOPING_AND_RLS_PASS'
\else
 \echo 'BUILD187_FAIL: admin session authorization mismatch'
 SELECT 1/0;
\endif

-- Recruiter: own role works, foreign admin role cannot be probed,
-- audit SELECT remains blocked and candidate sample SELECT is allowed.
SELECT set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',true);
SELECT (
 public.has_role('22222222-2222-4222-8222-222222222222'::uuid,'recruiter'::public.app_role)
 AND NOT public.has_role('22222222-2222-4222-8222-222222222222'::uuid,'admin'::public.app_role)
 AND NOT public.has_role('11111111-1111-4111-8111-111111111111'::uuid,'admin'::public.app_role)
 AND (SELECT count(*) FROM public.audit_probe)=0
 AND (SELECT count(*) FROM public.candidate_probe)=1
) AS build187_recruiter_session_correct \gset
\if :build187_recruiter_session_correct
 \echo 'BUILD187_RECRUITER_SCOPING_AND_RLS_PASS'
\else
 \echo 'BUILD187_FAIL: recruiter session authorization mismatch'
 SELECT 1/0;
\endif

-- Finance: own role true but RLS sample denies both unrelated datasets.
SELECT set_config('request.jwt.claim.sub',
 '33333333-3333-4333-8333-333333333333',true);
SELECT (
 public.has_role('33333333-3333-4333-8333-333333333333'::uuid,'finance'::public.app_role)
 AND NOT public.has_role('11111111-1111-4111-8111-111111111111'::uuid,'admin'::public.app_role)
 AND (SELECT count(*) FROM public.audit_probe)=0
 AND (SELECT count(*) FROM public.candidate_probe)=0
) AS build187_finance_session_correct \gset
\if :build187_finance_session_correct
 \echo 'BUILD187_FINANCE_ISOLATION_AND_RLS_PASS'
\else
 \echo 'BUILD187_FAIL: finance session authorization mismatch'
 SELECT 1/0;
\endif

-- Anon SQL EXECUTE must fail in practice, even with a forged lab GUC;
-- catch only insufficient_privilege, never accept another exception as pass.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',true);
DO $role_denial$
BEGIN
 BEGIN
  PERFORM public.has_role('11111111-1111-4111-8111-111111111111'::uuid,
                           'admin'::public.app_role);
  RAISE EXCEPTION 'BUILD187_FAIL: anonymous role invoked privileged helper';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'BUILD187_ANON_EXECUTE_DENIED';
 END;
END
$role_denial$;
RESET ROLE;
ROLLBACK;
DO $verify$
BEGIN
 IF to_regnamespace('auth') IS NOT NULL
 OR to_regtype('public.app_role') IS NOT NULL
 OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL
 OR to_regclass('public.user_roles') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))
 THEN RAISE EXCEPTION 'BUILD187_FAIL: disposable role helper fixture survived rollback'; END IF;
 RAISE NOTICE 'BUILD187_FULL_ROLLBACK_VERIFIED';
END
$verify$;
