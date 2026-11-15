-- Build179: DISPOSABLE PostgreSQL17 catalog preflight sensitivity verification.
-- NEVER run against a hosted project. No credentials except temporary CI service.
-- Original source-pinned Build160 preflight SQL is read unchanged from ephemeral psql buffer.
-- A fabricated inert RPC proves catalog-only matching is NOT behavior or release approval.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action_name text);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $stub$ SELECT NULL::uuid $stub$;
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $stub$ SELECT false $stub$;
CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
-- THIS FUNCTION IS INTENTIONALLY A NO-OP. Its catalog signature matches the
-- preflight, which cannot establish runtime correctness, authentication, or SMTP.
CREATE FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text)
 RETURNS TABLE(id uuid,status text)
 LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $stub$ SELECT NULL::uuid, 'NOOP_NOT_A_REAL_RECONCILIATION'::text WHERE false $stub$;
REVOKE ALL ON FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) TO service_role;
-- Read back only disposable function catalog fields (NOT SQL data rows).
SELECT p.proname,p.pronargs,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec,
 array_position(p.proconfig,'search_path=') IS NOT NULL AS exact_preflight_path_match
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='crm_email_confirm_sent_trusted';
-- The unchanged original Build160 preflight must incorrectly HOLD in this synthetic
-- positive catalog case: it searches for search_path= instead of search_path="".
\i /tmp/build178-audit-preflight.gset.sql
SELECT (:audit_named_rpc_count::integer=1 AND :audit_safe_rpc_count::integer=0 AND
 :'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_original_false_hold \gset
\if :build179_original_false_hold
 \echo 'BUILD179_ORIGINAL_PREFLIGHT_FALSE_HOLD_CONFIRMED'
\else
 \echo 'Build179 original unmodified preflight mismatch not reproduced'
 SELECT 1/0;
\endif
-- Candidate corrected catalog PRECHECK must reach REVIEW_ONLY; never production release.
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:audit_named_rpc_count::integer=1 AND :audit_safe_rpc_count::integer=1 AND
 :audit_admin_select_policies::integer=1 AND :audit_total_audit_policies::integer=1 AND
 :audit_broadly_permissive_all::integer=0 AND
 :'audit_audit_integrity_gate'='REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE')
 AS synthetic_catalog_match \gset
\if :synthetic_catalog_match
 \echo 'BUILD179_CATALOG_MATCH_IS_NOT_BEHAVIOR_OR_RELEASE: inert mock function matches metadata only'
\else
 \echo 'Build179 failed positive mock catalog control' :audit_named_rpc_count :audit_safe_rpc_count :audit_admin_select_policies :audit_total_audit_policies :audit_broadly_permissive_all :audit_audit_integrity_gate
 SELECT 1/0;
\endif

-- Mutation 1: anonymous read reintroduced, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT SELECT ON public.audit_logs TO anon;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_01: anonymous read reintroduced'
\else
 \echo 'Build179 failed adverse control 1: anonymous read reintroduced'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 2: anonymous truncate reintroduced, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT TRUNCATE ON public.audit_logs TO anon;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_02: anonymous truncate reintroduced'
\else
 \echo 'Build179 failed adverse control 2: anonymous truncate reintroduced'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 3: authenticated row mutation, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT UPDATE ON public.audit_logs TO authenticated;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_03: authenticated row mutation'
\else
 \echo 'Build179 failed adverse control 3: authenticated row mutation'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 4: authenticated schema-side privilege, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT MAINTAIN ON public.audit_logs TO authenticated;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_04: authenticated schema-side privilege'
\else
 \echo 'Build179 failed adverse control 4: authenticated schema-side privilege'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 5: trusted writer delete permission, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT DELETE ON public.audit_logs TO service_role;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_05: trusted writer delete permission'
\else
 \echo 'Build179 failed adverse control 5: trusted writer delete permission'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 6: trusted writer schema trigger privilege, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT TRIGGER ON public.audit_logs TO service_role;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_06: trusted writer schema trigger privilege'
\else
 \echo 'Build179 failed adverse control 6: trusted writer schema trigger privilege'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 7: universal permissive policy, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
CREATE POLICY "Unrestricted malicious regression" ON public.audit_logs FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_07: universal permissive policy'
\else
 \echo 'Build179 failed adverse control 7: universal permissive policy'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 8: trusted function public executable, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
GRANT EXECUTE ON FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) TO PUBLIC;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_08: trusted function public executable'
\else
 \echo 'Build179 failed adverse control 8: trusted function public executable'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 9: trusted function no longer service executable, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
REVOKE EXECUTE ON FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) FROM service_role;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_09: trusted function no longer service executable'
\else
 \echo 'Build179 failed adverse control 9: trusted function no longer service executable'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 10: trusted function switches to SECURITY DEFINER, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
ALTER FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) SECURITY DEFINER;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_10: trusted function switches to SECURITY DEFINER'
\else
 \echo 'Build179 failed adverse control 10: trusted function switches to SECURITY DEFINER'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 11: admin-only reader policy removed, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
DROP POLICY "read audit" ON public.audit_logs;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_11: admin-only reader policy removed'
\else
 \echo 'Build179 failed adverse control 11: admin-only reader policy removed'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;


-- Mutation 12: trusted writer loses INSERT, reverting with transaction-local SAVEPOINT.
SAVEPOINT build179_mutation;
REVOKE INSERT ON public.audit_logs FROM service_role;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT')
 AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_12: trusted writer loses INSERT'
\else
 \echo 'Build179 failed adverse control 12: trusted writer loses INSERT'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;

-- Mutant 13: a nonempty untrusted function search_path.
SAVEPOINT build179_mutation;
ALTER FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text) SET search_path TO public;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT') AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_13: unsafe function search path'
\else
 \echo 'Build179 failed mutant 13'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;
-- Mutant 14: same name/number of parameters, but wrong argument types.
SAVEPOINT build179_mutation;
DROP FUNCTION public.crm_email_confirm_sent_trusted(uuid,uuid,text,text);
CREATE FUNCTION public.crm_email_confirm_sent_trusted(text,text,text,text)
 RETURNS TABLE(id uuid,status text)
 LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $stub$ SELECT NULL::uuid,'NOOP_INVALID_SIGNATURE'::text WHERE false $stub$;
REVOKE ALL ON FUNCTION public.crm_email_confirm_sent_trusted(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_email_confirm_sent_trusted(text,text,text,text) TO service_role;
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT') AS build179_expected_hold \gset
\if :build179_expected_hold
 \echo 'BUILD179_EXPECTED_HOLD_14: incompatible function parameters'
\else
 \echo 'Build179 failed mutant 14'
 SELECT 1/0;
\endif
ROLLBACK TO SAVEPOINT build179_mutation;
RELEASE SAVEPOINT build179_mutation;
-- Mutations reverted, candidate corrected mock positive control must match again.
\i /tmp/build179-corrected-preflight.gset.sql
SELECT (:'audit_audit_integrity_gate'='REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE')
 AS build179_restored_mock_match \gset
\if :build179_restored_mock_match
 \echo 'BUILD179_RESTORED_CATALOG_MOCK_MATCH: still not behavior or release approval'
\else
 \echo 'Build179 failed to restore baseline between adverse probes'
 SELECT 1/0;
\endif
ROLLBACK;
DO $check$
BEGIN
 IF to_regclass('public.audit_logs') IS NOT NULL
 OR to_regnamespace('auth') IS NOT NULL OR to_regtype('public.app_role') IS NOT NULL
 OR to_regprocedure('public.crm_email_confirm_sent_trusted(uuid,uuid,text,text)') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) THEN
 RAISE EXCEPTION 'Build179 disposable control transaction failed to rollback';
 END IF;
 RAISE NOTICE 'BUILD179_FULL_ROLLBACK_VERIFIED';
END $check$;
