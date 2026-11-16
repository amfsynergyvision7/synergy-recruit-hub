#!/usr/bin/env bash
set -euo pipefail
# Ephemeral GitHub Actions PostgreSQL 17 container only. No real CRM database.
export PGPASSWORD="${PGPASSWORD:?Set synthetic PostgreSQL password}"
db=(psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres)
cleanup() {
  "${db[@]}" <<'SQL' >/dev/null 2>&1 || true
DROP SCHEMA IF EXISTS auth CASCADE;
DROP ROLE IF EXISTS anon;
DROP ROLE IF EXISTS authenticated;
SQL
}
trap cleanup EXIT
"${db[@]}" <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
SQL
echo 'Applying exact 15-table review draft to production-shaped synthetic schema with 140 checks'
"${db[@]}" -f security/build38/15-table-rls-source-shaped.integration.sql
echo 'Rehearsing 16-table grant hardening and public-branding exception'
"${db[@]}" -f security/build38/private-grants.integration.sql
echo 'PASS: Build38 two isolated database suites; no live project used'
