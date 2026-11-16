#!/usr/bin/env bash
# Build195: disposable Github CI PG17 + real GoTrue-issued JWT + full drafted RLS.
set -euo pipefail
[[ "$B195_DISPOSABLE_ONLY" == "true" ]]
[[ "$PGHOST" == "127.0.0.1" ]]
[[ "$PGUSER" == "postgres" ]]
[[ "$PGDATABASE" == "amf_build195_gotrue_35_policy_lab" ]]
[[ -n "$B195_JWT_SECRET" ]] && [[ "$(printf %s "$B195_JWT_SECRET" | wc -c)" -ge 32 ]]
[[ "$PGPASSWORD" == "synthetic-disposable-only" ]]
cleanup(){
  local result=$?
  if [[ "$result" != 0 ]]; then
    echo 'BUILD195_DISPOSABLE_ONLY_FAILURE_DIAGNOSTICS' >&2
    docker logs --tail 50 build195-gotrue >&2 2>/dev/null || true
    docker logs --tail 50 build195-postgrest >&2 2>/dev/null || true
  fi
  docker rm -f build195-gotrue build195-postgrest >/dev/null 2>&1 || true
  # Never drop anything outside the exact disposable, isolated CI DB.
  PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='amf_build195_gotrue_35_policy_lab' AND pid<>pg_backend_pid();" >/dev/null 2>&1 || true
  if ! PGDATABASE=postgres dropdb --if-exists amf_build195_gotrue_35_policy_lab >/dev/null 2>&1; then
    echo 'BUILD195_FAILED_TO_DROP_DISPOSABLE_DATABASE' >&2
    result=1
  fi
  local remaining
  remaining="$(PGDATABASE=postgres psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_database WHERE datname='amf_build195_gotrue_35_policy_lab'")" || result=1
  if [[ "$remaining" != "0" ]]; then
    echo 'BUILD195_DISPOSABLE_DATABASE_STILL_PRESENT' >&2
    result=1
  else
    echo 'BUILD195_EPHEMERAL_DATABASE_REMOVED_VERIFIED'
  fi
  if [[ "$result" != 0 ]]; then exit "$result"; fi
}
trap cleanup EXIT
command -v psql >/dev/null || (sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client)
PGDATABASE=postgres createdb amf_build195_gotrue_35_policy_lab
psql -X -v ON_ERROR_STOP=1 -f security/build151-production-permissions-review/build195-gotrue-auth-base.disposable.sql
docker run -d --rm --name build195-gotrue --network host \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 \
 -e API_EXTERNAL_URL=http://127.0.0.1:9999 \
 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_NAMESPACE=auth \
 -e GOTRUE_DB_DATABASE_URL="postgres://postgres:synthetic-disposable-only@127.0.0.1:5432/amf_build195_gotrue_35_policy_lab?sslmode=disable&options=-csearch_path%3Dauth%2Cpublic" \
 -e DATABASE_URL="postgres://postgres:synthetic-disposable-only@127.0.0.1:5432/amf_build195_gotrue_35_policy_lab?sslmode=disable&options=-csearch_path%3Dauth%2Cpublic" \
 -e GOTRUE_SITE_URL=http://127.0.0.1:3000 \
 -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
 -e GOTRUE_MAILER_AUTOCONFIRM=true \
 -e GOTRUE_JWT_SECRET="$B195_JWT_SECRET" \
 -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_JWT_EXP=3600 -e GOTRUE_LOG_LEVEL=warn \
 supabase/gotrue:v2.197.0 >/dev/null
ready=0
for _ in $(seq 1 60); do
 if curl -fsS -o /dev/null http://127.0.0.1:9999/health; then ready=1; break; fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo 'GoTrue startup failed' >&2; exit 1; }
for _ in $(seq 1 60); do
 if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT to_regclass('auth.identities') IS NOT NULL")" == t ]]; then break; fi
 sleep 1
done
node security/build151-production-permissions-review/build195-prepare-full-gotrue.disposable.mjs
psql -X -v ON_ERROR_STOP=1 -f "$RUNNER_TEMP/build195-ephemeral/source-shaped-bootstrap.sql"
psql -X -v ON_ERROR_STOP=1 -f "$RUNNER_TEMP/build195-ephemeral/install-only-in-ephemeral-db.sql"
psql -X -At -v ON_ERROR_STOP=1 -f security/build151-production-permissions-review/build191-postflight.readonly.sql |
  grep -F 'REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE' >/dev/null
psql -X -At -v ON_ERROR_STOP=1 -f security/build151-production-permissions-review/build192-exact-35-policy-fingerprint.readonly.sql |
  grep -F 'REVIEW_ONLY_EXACT_35_POLICY_SOURCE_MATCH_NOT_RELEASE' >/dev/null
echo 'BUILD195_POSTFLIGHT_AND_EXACT_35_POLICY_FINGERPRINT_VERIFIED'
docker run -d --rm --name build195-postgrest --network host \
 -e PGRST_DB_URI="postgres://authenticator:build195_local_authenticator_only_7s9q@127.0.0.1:5432/amf_build195_gotrue_35_policy_lab" \
 -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET="$B195_JWT_SECRET" -e PGRST_SERVER_PORT=3000 \
 postgrest/postgrest:v12.2.3 >/dev/null
node security/build151-production-permissions-review/build195-full-gotrue-35-policy-http.test.mjs
echo 'BUILD195_ACTUAL_GOTRUE_FULL_DRAFT_35_POLICIES_VERIFIED_DISPOSABLE_ONLY'
