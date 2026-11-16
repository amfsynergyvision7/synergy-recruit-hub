#!/usr/bin/env bash
set -euo pipefail
if [[ -z "$PGPASSWORD" ]]; then echo 'Synthetic PG password required' >&2; exit 1; fi
db() { psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres "$@"; }
cleanup() {
  db <<'SQL' >/dev/null 2>&1 || true
DROP ROLE IF EXISTS anon;
DROP ROLE IF EXISTS authenticated;
DROP ROLE IF EXISTS service_role;
SQL
}
trap cleanup EXIT
echo "[1/3] privileged function grant contract"
db -f security/build40/16-security-definer-acl.integration.sql
echo "[2/3] 19-table/13-view production-shaped contract"
db <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
SQL
db -f security/build40/19-table-13-view-source-shaped.integration.sql
db <<'SQL'
DROP ROLE anon;
DROP ROLE authenticated;
SQL
echo "[3/3] 19-table private privilege and ownership-column contract"
db -f security/build40/19-table-privileges.integration.sql
echo "PASS: three independent disposable PostgreSQL test suites"
