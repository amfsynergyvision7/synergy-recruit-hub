-- Disposable Postgres 17 CI only. Uses the actual review SQL and synthetic roles.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
\ir sync-lease-review-only.sql
DO $assert$
BEGIN
  IF has_schema_privilege('anon','crm_private','USAGE') THEN RAISE EXCEPTION 'anon private schema usage'; END IF;
  IF has_schema_privilege('authenticated','crm_private','USAGE') THEN RAISE EXCEPTION 'authenticated private schema usage'; END IF;
  IF has_table_privilege('anon','crm_private.candidate_sync_leases','SELECT') THEN RAISE EXCEPTION 'anon lease table select'; END IF;
  IF has_function_privilege('anon','public.crm_claim_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon claim EXECUTE'; END IF;
  IF has_function_privilege('authenticated','public.crm_refresh_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'auth refresh EXECUTE'; END IF;
  IF has_function_privilege('anon','public.crm_release_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon release EXECUTE'; END IF;
  IF NOT has_function_privilege('service_role','public.crm_claim_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'service claim missing'; END IF;
  IF NOT has_function_privilege('service_role','public.crm_refresh_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'service refresh missing'; END IF;
  IF NOT has_function_privilege('service_role','public.crm_release_candidate_sync_lease(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'service release missing'; END IF;
END $assert$;
SET ROLE anon;
DO $check$
BEGIN
  BEGIN
    PERFORM public.crm_claim_candidate_sync_lease('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'anon invoked claim function';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $check$;
RESET ROLE;
SET ROLE service_role;
DO $check$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
        b uuid:='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
        first_token uuid:='11111111-1111-4111-8111-111111111111';
        second_token uuid:='22222222-2222-4222-8222-222222222222';
BEGIN
  IF NOT public.crm_claim_candidate_sync_lease(a,first_token) THEN RAISE EXCEPTION 'first claim failed'; END IF;
  IF public.crm_claim_candidate_sync_lease(a,second_token) THEN RAISE EXCEPTION 'competing claim accepted'; END IF;
  IF NOT public.crm_claim_candidate_sync_lease(b,second_token) THEN RAISE EXCEPTION 'independent owner blocked'; END IF;
  IF public.crm_refresh_candidate_sync_lease(a,second_token) THEN RAISE EXCEPTION 'stale token refreshed'; END IF;
  IF NOT public.crm_refresh_candidate_sync_lease(a,first_token) THEN RAISE EXCEPTION 'valid token refresh failed'; END IF;
  IF public.crm_release_candidate_sync_lease(a,second_token) THEN RAISE EXCEPTION 'stale token released'; END IF;
  IF NOT public.crm_release_candidate_sync_lease(a,first_token) THEN RAISE EXCEPTION 'valid release failed'; END IF;
  IF public.crm_release_candidate_sync_lease(a,first_token) THEN RAISE EXCEPTION 'double release succeeded'; END IF;
  IF NOT public.crm_claim_candidate_sync_lease(a,second_token) THEN RAISE EXCEPTION 'reacquire after release failed'; END IF;
END $check$;
RESET ROLE;
-- Simulate a lease expiring, then prove a new token can claim it.
UPDATE crm_private.candidate_sync_leases
SET expires_at=clock_timestamp()-interval '1 second'
WHERE owner_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
SET ROLE service_role;
DO $check$
BEGIN
  IF NOT public.crm_claim_candidate_sync_lease(
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333')
    THEN RAISE EXCEPTION 'expired lease could not be reclaimed'; END IF;
  IF public.crm_refresh_candidate_sync_lease(
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')
    THEN RAISE EXCEPTION 'previous owner token renewed'; END IF;
END $check$;
RESET ROLE;
DROP FUNCTION public.crm_claim_candidate_sync_lease(uuid,uuid);
DROP FUNCTION public.crm_refresh_candidate_sync_lease(uuid,uuid);
DROP FUNCTION public.crm_release_candidate_sync_lease(uuid,uuid);
DROP SCHEMA crm_private CASCADE;
DROP ROLE anon;
DROP ROLE authenticated;
DROP ROLE service_role;
SELECT 'PASS: actual lease SQL ACL, claims, expiry, stale tokens and cleanup' AS outcome,
 NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='crm_private') AS schema_absent,
 NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='crm_claim_candidate_sync_lease') AS functions_absent;
