-- Review/test fixture: disposable PostgreSQL 17 only. Never execute against production.
BEGIN;
CREATE SCHEMA build36_synthetic;
CREATE TABLE build36_synthetic.lease (
  owner_id uuid PRIMARY KEY,
  token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL
);
CREATE FUNCTION build36_synthetic.claim_lease(p_owner uuid,p_token uuid,p_clock timestamptz,p_ttl interval)
RETURNS boolean LANGUAGE plpgsql AS $fn$
DECLARE changed integer;
BEGIN
  IF p_ttl<=interval '0 second' OR p_ttl>interval '30 minute' THEN
    RAISE EXCEPTION 'Invalid lease TTL';
  END IF;
  INSERT INTO build36_synthetic.lease(owner_id,token,lease_expires_at)
  VALUES(p_owner,p_token,p_clock+p_ttl)
  ON CONFLICT (owner_id) DO UPDATE SET
    token=EXCLUDED.token,
    lease_expires_at=EXCLUDED.lease_expires_at
  WHERE build36_synthetic.lease.lease_expires_at <= p_clock;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $fn$;
CREATE FUNCTION build36_synthetic.release_lease(p_owner uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql AS $fn$
DECLARE changed integer;
BEGIN
  DELETE FROM build36_synthetic.lease WHERE owner_id=p_owner AND token=p_token;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $fn$;
DO $test$
DECLARE
  a uuid:='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  b uuid:='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  ta uuid:='11111111-1111-4111-8111-111111111111';
  tb uuid:='22222222-2222-4222-8222-222222222222';
  t0 timestamptz:='2030-01-01T00:00:00Z';
BEGIN
  IF NOT build36_synthetic.claim_lease(a,ta,t0,interval '10 minutes')
     THEN RAISE EXCEPTION 'first claim failed'; END IF;
  IF build36_synthetic.claim_lease(a,tb,t0+interval '1 minute',interval '10 minutes')
     THEN RAISE EXCEPTION 'second claim wrongly accepted'; END IF;
  IF (SELECT token FROM build36_synthetic.lease WHERE owner_id=a)<>ta
     THEN RAISE EXCEPTION 'owner overwritten while lease active'; END IF;
  IF NOT build36_synthetic.claim_lease(b,tb,t0,interval '10 minutes')
     THEN RAISE EXCEPTION 'separate owner blocked'; END IF;
  IF NOT build36_synthetic.claim_lease(a,tb,t0+interval '11 minutes',interval '10 minutes')
     THEN RAISE EXCEPTION 'expired lease could not be reclaimed'; END IF;
  IF build36_synthetic.release_lease(a,ta)
     THEN RAISE EXCEPTION 'previous owner token released new lock'; END IF;
  IF NOT build36_synthetic.release_lease(a,tb)
     THEN RAISE EXCEPTION 'current token could not release'; END IF;
  IF (SELECT count(*) FROM build36_synthetic.lease)<>1
     THEN RAISE EXCEPTION 'unexpected lease table state'; END IF;
  IF build36_synthetic.release_lease(a,tb)
     THEN RAISE EXCEPTION 'duplicate release accepted'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: lease transitions and rollback' AS outcome,
  NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='build36_synthetic') AS schema_rolled_back;
