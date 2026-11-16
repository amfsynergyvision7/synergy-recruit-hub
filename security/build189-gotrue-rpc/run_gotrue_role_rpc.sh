#!/usr/bin/env bash
# Build189 CI-only GoTrue-issued JWT/PostgREST/RLS test. NO HOSTED ACCESS.
set -euo pipefail
if [[ -z "$PGPASSWORD" || -z "$B189_JWT_SECRET" ]]; then
 echo 'Build189 disposable credentials missing' >&2; exit 1
fi
if [[ "$(printf %s "$B189_JWT_SECRET" | wc -c)" -lt 32 ]]; then
 echo 'Build189 test JWT key too short' >&2; exit 1
fi
cleanup(){
 local status=$?
 if [[ "$status" != 0 ]]; then
  echo 'Build189 disposable GoTrue diagnostics (synthetic only):' >&2
  docker logs --tail 65 build189-gotrue 2>&1 || true
  echo 'Build189 disposable PostgREST diagnostics:' >&2
  docker logs --tail 65 build189-postgrest 2>&1 || true
 fi
 docker rm -f build189-gotrue build189-postgrest >/dev/null 2>&1 || true
}
trap cleanup EXIT
# Identical Git blob content copied from existing Build42's disposable auth
# bootstrap; never write to hosted/staging/production Supabase.
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
 -f security/build189-gotrue-rpc/gotrue-auth-base-schema.disposable.sql

docker run -d --rm --name build189-gotrue --network host \
 -e GOTRUE_API_HOST=0.0.0.0 \
 -e GOTRUE_API_PORT=9999 \
 -e API_EXTERNAL_URL=http://127.0.0.1:9999 \
 -e GOTRUE_DB_DRIVER=postgres \
 -e GOTRUE_DB_NAMESPACE=auth \
 -e GOTRUE_DB_DATABASE_URL="postgres://postgres:synthetic-disposable-only@127.0.0.1:5432/postgres?sslmode=disable&options=-csearch_path%3Dauth%2Cpublic" \
 -e DATABASE_URL="postgres://postgres:synthetic-disposable-only@127.0.0.1:5432/postgres?sslmode=disable&options=-csearch_path%3Dauth%2Cpublic" \
 -e GOTRUE_SITE_URL=http://127.0.0.1:3000 \
 -e GOTRUE_DISABLE_SIGNUP=false \
 -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
 -e GOTRUE_MAILER_AUTOCONFIRM=true \
 -e GOTRUE_JWT_SECRET="$B189_JWT_SECRET" \
 -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_JWT_EXP=3600 \
 -e GOTRUE_LOG_LEVEL=warn \
 supabase/gotrue:v2.197.0 >/dev/null
ready=0
for _ in $(seq 1 60); do
 if curl -fsS -o /dev/null http://127.0.0.1:9999/health; then ready=1; break; fi
 sleep 1
done
if [[ "$ready" != 1 ]]; then echo 'Build189 disposable GoTrue did not start' >&2; exit 1; fi
authready=0
for _ in $(seq 1 60); do
 if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c \
 "SELECT to_regclass('auth.identities') IS NOT NULL;")" == t ]]; then authready=1; break; fi
 sleep 1
done
if [[ "$authready" != 1 ]]; then echo 'Build189 GoTrue auth migrations incomplete' >&2; exit 1; fi
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
 -f security/build189-gotrue-rpc/app-bootstrap.disposable.sql
docker run -d --rm --name build189-postgrest --network host \
 -e PGRST_DB_URI="postgres://authenticator:build189_ephemeral_authenticator_only_7w5q@127.0.0.1:5432/postgres" \
 -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET="$B189_JWT_SECRET" \
 -e PGRST_SERVER_PORT=3000 \
 postgrest/postgrest:v12.2.3 >/dev/null
node security/build189-gotrue-rpc/gotrue-issued-role-rpc.test.mjs
echo 'BUILD189_GOTRUE_ISSUED_REAL_JWT_HTTP_TESTS_COMPLETE_DISPOSABLE_ONLY'
