#!/usr/bin/env bash
# Build188: disposable GitHub Actions PG17/PostgREST only. No hosted DB/API.
set -euo pipefail
if [[ -z "$PGPASSWORD" || -z "$B188_JWT_SECRET" ]]; then
 echo 'Synthetic CI variables missing' >&2; exit 1
fi
if [[ "$(printf %s "$B188_JWT_SECRET" | wc -c)" -lt 32 ]]; then
 echo 'Synthetic JWT key must be at least 32 bytes' >&2; exit 1
fi
cleanup(){
 local result=$?
 if [[ "$result" -ne 0 ]]; then
  echo 'Disposable test server diagnostics (fictional records only):' >&2
  docker logs --tail 50 build188-postgrest 2>&1 || true
 fi
 docker rm -f build188-postgrest >/dev/null 2>&1 || true
}
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
 -f security/build188-signed-rpc/bootstrap.disposable.sql
docker run -d --rm --name build188-postgrest --network host \
 -e PGRST_DB_URI="postgres://authenticator:b188_disposable_authenticator_only_6r4h@127.0.0.1:5432/postgres" \
 -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET="$B188_JWT_SECRET" \
 -e PGRST_SERVER_PORT=3000 \
 postgrest/postgrest:v12.2.3 >/dev/null
ready=0
for _ in $(seq 1 45); do
 if curl -s -o /dev/null http://127.0.0.1:3000/; then ready=1; break; fi
 sleep 1
done
if [[ "$ready" -ne 1 ]]; then echo 'Disposable PostgREST failed to start' >&2; exit 1; fi
node security/build188-signed-rpc/signed-role-rpc.test.mjs
echo 'BUILD188_DISPOSABLE_HTTP_TESTS_COMPLETE_NO_HOSTED_WRITES'
