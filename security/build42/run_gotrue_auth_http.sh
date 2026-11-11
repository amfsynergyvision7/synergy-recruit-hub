#!/usr/bin/env bash
# Disposable GitHub Actions ONLY: no hosted Supabase project and no live CRM data.
set -euo pipefail
if test -z "$PGPASSWORD" || test -z "$B42_JWT_SECRET"; then echo 'Synthetic CI credentials required' >&2; exit 1; fi
if test "$(printf '%s' "$B42_JWT_SECRET" | wc -c)" -lt 32; then echo 'Synthetic JWT secret too short' >&2; exit 1; fi
cleanup() {
  docker rm -f build42-gotrue build42-postgrest >/dev/null 2>&1 || true
}
trap cleanup EXIT
# GoTrue migrations target auth.users; the disposable Postgres image has no auth schema.
psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -c 'CREATE SCHEMA IF NOT EXISTS auth;'
docker run -d --rm --name build42-gotrue --network host \
  -e GOTRUE_API_HOST=0.0.0.0 \
  -e GOTRUE_API_PORT=9999 \
  -e API_EXTERNAL_URL=http://127.0.0.1:9999 \
  -e GOTRUE_DB_DRIVER=postgres \
  -e GOTRUE_DB_NAMESPACE=auth \
  -e GOTRUE_DB_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable" \
  -e DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable" \
  -e GOTRUE_SITE_URL=http://localhost:3000 \
  -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e GOTRUE_JWT_SECRET="$B42_JWT_SECRET" \
  -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_LOG_LEVEL=warn \
  supabase/gotrue:v2.197.0
ready=0
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:9999/health; then ready=1; break; fi
  sleep 1
done
if test "$ready" != 1; then echo 'GoTrue did not start' >&2; docker logs build42-gotrue | tail -70; exit 1; fi
psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -c "SELECT CASE WHEN to_regclass('auth.identities') IS NULL THEN (SELECT 1/0) ELSE 1 END AS gotrue_schema_ready;"
psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -f security/build42/gotrue-production-shaped-bootstrap.sql
docker run -d --rm --name build42-postgrest --network host \
  -e PGRST_DB_URI="postgres://authenticator:b41_synthetic_postgrest_login_only@localhost:5432/postgres" \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_JWT_SECRET="$B42_JWT_SECRET" \
  -e PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v12.2.3
node security/build42/gotrue-issued-jwt-http.test.mjs
