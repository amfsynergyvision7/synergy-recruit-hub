#!/usr/bin/env bash
# Disposable PostgreSQL 17 CI only. No production credentials or data.
set -euo pipefail
tmp="$(mktemp -d)"
pid=''
cleanup() {
  if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  psql -X -q -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres <<'SQL' >/dev/null 2>&1 || true
DROP FUNCTION IF EXISTS public.crm_claim_candidate_sync_lease(uuid,uuid);
DROP FUNCTION IF EXISTS public.crm_refresh_candidate_sync_lease(uuid,uuid);
DROP FUNCTION IF EXISTS public.crm_release_candidate_sync_lease(uuid,uuid);
DROP SCHEMA IF EXISTS crm_private CASCADE;
DROP ROLE IF EXISTS anon;
DROP ROLE IF EXISTS authenticated;
DROP ROLE IF EXISTS service_role;
SQL
  rm -rf "$tmp"
}
trap cleanup EXIT
psql -X -q -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres <<'SQL' >/dev/null
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SQL
psql -X -q -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -f security/build37/sync-lease-review-only.sql >/dev/null
# The first session sleeps while its claimed lease is still uncommitted.
psql -X -A -t -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres \
 -c "BEGIN; SET ROLE service_role; SELECT public.crm_claim_candidate_sync_lease('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'); SELECT pg_sleep(4); COMMIT;" > "$tmp/first" &
pid=$!
sleep 1
# The second session must be denied after the first transaction commits.
psql -X -A -t -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres \
 -c "SET ROLE service_role; SELECT public.crm_claim_candidate_sync_lease('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');" > "$tmp/second"
wait "$pid"
pid=''
if ! grep -qx 't' "$tmp/first"; then echo 'FAIL: first claim' >&2; exit 1; fi
if ! grep -qx 'f' "$tmp/second"; then echo 'FAIL: second concurrent claim was not rejected' >&2; exit 1; fi
echo 'PASS: two independent PostgreSQL sessions, competing owner claim rejected'
