#!/usr/bin/env bash
# Build43 disposable PostgreSQL CI. Never pass live CRM credentials.
set -euo pipefail
if [[ -z "$PGPASSWORD" ]]; then echo 'Synthetic CI password required' >&2; exit 1; fi
TEST_DB=build43_atomic_recovery
RESTORE_DB=build43_restored_snapshot
tmp="$(mktemp -d)"
db() { local name="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$name" "$@"; }
cleanup() {
 db postgres -c "DROP DATABASE IF EXISTS $RESTORE_DB WITH (FORCE)" >/dev/null 2>&1 || true
 db postgres -c "DROP DATABASE IF EXISTS $TEST_DB WITH (FORCE)" >/dev/null 2>&1 || true
 db postgres <<'SQL' >/dev/null 2>&1 || true
DROP ROLE IF EXISTS anon;
DROP ROLE IF EXISTS authenticated;
DROP ROLE IF EXISTS service_role;
SQL
 rm -rf "$tmp"
}
trap cleanup EXIT
db postgres <<'SQL' >/dev/null
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE DATABASE build43_atomic_recovery;
SQL
db "$TEST_DB" -f security/build43/atomic-recovery-bootstrap.sql >/dev/null
db "$TEST_DB" -f security/build43/candidate-row-commit-review-only.sql >/dev/null
owner=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa
token=22222222-2222-4222-8222-222222222222
integration=44444444-4444-4444-8444-444444444444
call="SELECT outcome FROM public.crm_commit_candidate_sync_row('$owner','$token','$integration',2,'{\"full_name\":\"Synthetic A\",\"email\":\"synthetic@example.invalid\",\"mobile\":\"111\"}');"
psql -X -qAt -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$TEST_DB" \
 -c "BEGIN;" -c "$call" -c "SELECT pg_sleep(4);" -c "COMMIT;" >"$tmp/first" &
first_pid=$!
ready=0
for attempt in $(seq 1 40); do
 if grep -qx 'created' "$tmp/first" 2>/dev/null; then ready=1; break; fi
 sleep 0.1
done
if [[ "$ready" != 1 ]]; then
 kill "$first_pid" 2>/dev/null || true
 wait "$first_pid" 2>/dev/null || true
 echo 'First worker did not acquire row before contention' >&2; exit 1
fi
psql -X -qAt -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$TEST_DB" -c "$call" >"$tmp/second"
wait "$first_pid"
grep -qx 'created' "$tmp/first" || { echo 'First worker did not create once' >&2; exit 1; }
grep -qx 'replayed' "$tmp/second" || { echo 'Second worker did not replay safely' >&2; exit 1; }
db "$TEST_DB" <<'SQL' >/dev/null
DO $check$ DECLARE n int;BEGIN
 SELECT count(*) INTO n FROM public.candidates; IF n<>1 THEN RAISE EXCEPTION 'candidate count %',n; END IF;
 SELECT count(*) INTO n FROM public.notifications; IF n<>1 THEN RAISE EXCEPTION 'notification count %',n; END IF;
 SELECT count(*) INTO n FROM crm_private.candidate_sync_row_ledger; IF n<>1 THEN RAISE EXCEPTION 'ledger count %',n; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations)<>2 THEN RAISE EXCEPTION 'cursor mismatch'; END IF;
END $check$;
SQL
echo 'PASS: two real PostgreSQL sessions committed one candidate, notification and ledger'
db "$TEST_DB" <<'SQL' >/dev/null
CREATE FUNCTION public.build43_pause_notice() RETURNS trigger LANGUAGE plpgsql AS $pause$ BEGIN PERFORM pg_sleep(2); RETURN NEW; END $pause$;
CREATE TRIGGER build43_delay_notice BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.build43_pause_notice();
UPDATE crm_private.candidate_sync_leases SET expires_at=clock_timestamp()+interval '1 second';
DO $expiry$ BEGIN
 BEGIN
  PERFORM * FROM public.crm_commit_candidate_sync_row(
   'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',
   '44444444-4444-4444-8444-444444444444',3,'{"full_name":"Synthetic Expire","email":"expire@example.invalid"}'
  );
  RAISE EXCEPTION 'Expired in-flight row unexpectedly committed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM public.candidates)<>1 THEN RAISE EXCEPTION 'expired candidate partially committed'; END IF;
 IF (SELECT count(*) FROM public.notifications)<>1 THEN RAISE EXCEPTION 'expired notification partially committed'; END IF;
 IF (SELECT count(*) FROM crm_private.candidate_sync_row_ledger)<>1 THEN RAISE EXCEPTION 'expired ledger partially committed'; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations)<>2 THEN RAISE EXCEPTION 'expired cursor changed'; END IF;
END $expiry$;
SQL
echo 'PASS: in-flight lease expiry rolled back an entire row transaction'
pg_dump -Fc --no-owner -h localhost -U postgres -d "$TEST_DB" -f "$tmp/atomic.backup"
db postgres -c "CREATE DATABASE $RESTORE_DB" >/dev/null
pg_restore --exit-on-error --no-owner -h localhost -U postgres -d "$RESTORE_DB" "$tmp/atomic.backup"
db "$RESTORE_DB" <<'SQL'
DO $restore$ DECLARE n int;BEGIN
 SELECT count(*) INTO n FROM public.candidates; IF n<>1 THEN RAISE EXCEPTION 'restored candidates %',n; END IF;
 SELECT count(*) INTO n FROM public.notifications; IF n<>1 THEN RAISE EXCEPTION 'restored notices %',n; END IF;
 SELECT count(*) INTO n FROM crm_private.candidate_sync_row_ledger; IF n<>1 THEN RAISE EXCEPTION 'restored ledger %',n; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations)<>2 THEN RAISE EXCEPTION 'restored cursor'; END IF;
 IF has_function_privilege('anon','public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anonymous RPC privilege restored insecurely'; END IF;
 IF NOT has_function_privilege('service_role','public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'service RPC privilege not restored'; END IF;
END $restore$;
SQL
echo 'PASS: full synthetic schema+data backup/restore with ledger, cursor and RPC grants'
