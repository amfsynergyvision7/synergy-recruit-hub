-- Build 37: REVIEW-ONLY database-backed owner lease. DO NOT APPLY TO PRODUCTION.
-- Database functions are callable ONLY by service_role; no schedule or secret is enabled.
-- Needs independent DBA review, tested restore and nine formal release gates.
BEGIN;
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS crm_private.candidate_sync_leases (
  owner_id uuid PRIMARY KEY,
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE crm_private.candidate_sync_leases FROM PUBLIC, anon, authenticated;
ALTER TABLE crm_private.candidate_sync_leases ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.crm_claim_candidate_sync_lease(p_owner uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $fn$
DECLARE n integer;
BEGIN
  IF p_owner IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  INSERT INTO crm_private.candidate_sync_leases(owner_id,lease_token,expires_at)
  VALUES (p_owner,p_token,clock_timestamp()+interval '15 minutes')
  ON CONFLICT(owner_id) DO UPDATE
    SET lease_token=EXCLUDED.lease_token,
        expires_at=EXCLUDED.expires_at
  WHERE crm_private.candidate_sync_leases.expires_at<=clock_timestamp();
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END $fn$;
CREATE FUNCTION public.crm_refresh_candidate_sync_lease(p_owner uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $fn$
DECLARE n integer;
BEGIN
  IF p_owner IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  UPDATE crm_private.candidate_sync_leases
  SET expires_at=clock_timestamp()+interval '15 minutes'
  WHERE owner_id=p_owner AND lease_token=p_token AND expires_at>clock_timestamp();
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END $fn$;
CREATE FUNCTION public.crm_release_candidate_sync_lease(p_owner uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $fn$
DECLARE n integer;
BEGIN
  IF p_owner IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  DELETE FROM crm_private.candidate_sync_leases WHERE owner_id=p_owner AND lease_token=p_token;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_claim_candidate_sync_lease(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_refresh_candidate_sync_lease(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_release_candidate_sync_lease(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_claim_candidate_sync_lease(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_refresh_candidate_sync_lease(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_release_candidate_sync_lease(uuid,uuid) TO service_role;
COMMIT;
-- Blockers: lease TTL expiry can overlap a long in-flight write; no transactional
-- candidate fence, unique candidate identifiers, restore evidence or true load test.
-- Do not activate scheduled synchronization by setting feature flag on this basis.
