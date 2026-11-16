#!/usr/bin/env bash
# Build60 strict synthetic-only pg_dump/pg_restore disaster recovery drill.
# NEVER run this against real Supabase, shared staging, or any external host.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${B60_DISPOSABLE_ONLY:-}" != "yes" ||
      "${PGHOST:-}" != "localhost" ||
      "${PGPORT:-}" != "5432" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGDATABASE:-}" != "postgres" ]]; then
  echo 'Build60 backup rehearsal REFUSED: must be disposable GitHub PostgreSQL 17 on localhost' >&2
  exit 84
fi
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v psql >/dev/null
command -v createdb >/dev/null
command -v dropdb >/dev/null
tmp="$(mktemp -d)"
src="b60_synthetic_source"
dst="b60_synthetic_restored"
cleanup(){
  set +e
  dropdb --if-exists "$dst" >/dev/null 2>&1
  dropdb --if-exists "$src" >/dev/null 2>&1
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "DROP ROLE IF EXISTS anon,authenticated,service_role;" >/dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "CREATE ROLE anon NOLOGIN;"   -c "CREATE ROLE authenticated NOLOGIN;"   -c "CREATE ROLE service_role NOLOGIN BYPASSRLS;"
createdb "$src"
createdb "$dst"
psql -X -q -v ON_ERROR_STOP=1 -d "$src" -f security/build60/synthetic-recovery-source.sql

digest_before="$(psql -X -At -v ON_ERROR_STOP=1 -d "$src" -f security/build60/synthetic-recovery-digest.sql | tail -1)"
test -n "$digest_before"

# Custom-format physical snapshot with original GRANTs, RLS policies and
# trigger definitions; do NOT pass --no-acl or --no-owner.
pg_dump -Fc -d "$src" -f "$tmp/recovery.dump"
test -s "$tmp/recovery.dump"
pg_restore -l "$tmp/recovery.dump" >"$tmp/manifest.txt"
grep -q 'POLICY' "$tmp/manifest.txt"
grep -q 'TRIGGER' "$tmp/manifest.txt"
grep -q 'VIEW' "$tmp/manifest.txt"

# Simulate source destruction AFTER the backup; never modify the backup.
psql -X -q -v ON_ERROR_STOP=1 -d "$src"  -c "DROP TABLE public.billing CASCADE;"  -c "UPDATE public.candidates SET stage='joined';"
pg_restore -e -d "$dst" "$tmp/recovery.dump"

digest_after="$(psql -X -At -v ON_ERROR_STOP=1 -d "$dst" -f security/build60/synthetic-recovery-digest.sql | tail -1)"
if [[ "$digest_before" != "$digest_after" ]]; then
  echo 'Build60 recovery FAIL: recovered synthetic row digest mismatched' >&2
  exit 1
fi
psql -X -q -v ON_ERROR_STOP=1 -d "$dst" -f security/build60/synthetic-recovery-verify.sql

echo 'PASS Build60 synthetic pg_dump/pg_restore: row digest, RLS, grants, invoker view, blocked invoice writes, signed-role isolation and cleanup'
