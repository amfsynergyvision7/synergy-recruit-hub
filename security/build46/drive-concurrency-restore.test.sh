#!/usr/bin/env bash
# Build 46: disposable PostgreSQL two-worker Drive import and restore rehearsal.
set -euo pipefail
if [[ -z "$PGPASSWORD" ]]; then echo 'Synthetic CI password required' >&2; exit 1; fi
DB=build46_drive_atomic
SNAP=build46_drive_restored
tmp="$(mktemp -d)"
db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$database" "$@"; }
cleanup() {
 db postgres -c "DROP DATABASE IF EXISTS $SNAP WITH (FORCE)" >/dev/null 2>&1 || true
 db postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" >/dev/null 2>&1 || true
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
CREATE DATABASE build46_drive_atomic;
SQL
db "$DB" -f security/build46/drive-concurrency-bootstrap.sql >/dev/null
call="SELECT outcome FROM public.crm_commit_drive_resume_import(
 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 'folderABC123','driveFileABC123',
 '{\"full_name\":\"Concurrent Candidate\",\"email\":\"concurrent@example.invalid\",\"mobile\":\"1234567890\"}');"
psql -X -qAt -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$DB" \
 -c "BEGIN;" -c "$call" -c "SELECT pg_sleep(4);" -c "COMMIT;" >"$tmp/first" &
first_pid=$!
ready=0
for i in $(seq 1 60); do
 if grep -qx 'created' "$tmp/first" 2>/dev/null; then ready=1; break; fi
 sleep 0.1
done
if [[ "$ready" != 1 ]]; then
 kill "$first_pid" 2>/dev/null || true; wait "$first_pid" 2>/dev/null || true
 echo 'First worker could not acquire file ledger' >&2; exit 1
fi
psql -X -qAt -v ON_ERROR_STOP=1 -h localhost -U postgres -d "$DB" -c "$call" >"$tmp/second"
wait "$first_pid"
grep -qx 'created' "$tmp/first"
grep -qx 'replayed' "$tmp/second"
db "$DB" <<'SQL' >/dev/null
DO $verify$ DECLARE n int;BEGIN
 SELECT count(*) INTO n FROM public.candidates;
 IF n<>1 THEN RAISE EXCEPTION 'concurrent duplicate candidate %',n; END IF;
 SELECT count(*) INTO n FROM crm_private.drive_resume_import_ledger;
 IF n<>1 THEN RAISE EXCEPTION 'concurrent duplicate file ledger %',n; END IF;
 IF (SELECT assigned_recruiter FROM public.candidates) <> '11111111-1111-4111-8111-111111111111'
 THEN RAISE EXCEPTION 'concurrent assignment changed'; END IF;
END $verify$;
SQL
echo 'PASS: two real Drive-import sessions committed one candidate/ledger and one safe replay'
pg_dump -Fc --no-owner -h localhost -U postgres -d "$DB" -f "$tmp/drive.backup"
db postgres -c "CREATE DATABASE $SNAP" >/dev/null
pg_restore --exit-on-error --no-owner -h localhost -U postgres -d "$SNAP" "$tmp/drive.backup"
db "$SNAP" <<'SQL'
DO $restore$ BEGIN
 IF (SELECT count(*) FROM public.candidates)<>1
 OR (SELECT count(*) FROM crm_private.drive_resume_import_ledger)<>1
 THEN RAISE EXCEPTION 'synthetic restored data incomplete'; END IF;
 IF has_function_privilege('anon','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'restored untrusted Drive EXECUTE grant'; END IF;
 IF NOT has_function_privilege('service_role','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'restored service role grant missing'; END IF;
END $restore$;
SQL
echo 'PASS: full synthetic PostgreSQL Drive backup/restore preserves ledger, data and RPC ACL'
db "$SNAP" <<'SQL' >/dev/null
REVOKE EXECUTE ON FUNCTION public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.crm_list_drive_imported_file_ids(uuid,text) FROM service_role;
DO $stop$ BEGIN
 IF has_function_privilege('service_role','public.crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_list_drive_imported_file_ids(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'emergency Drive hold failed'; END IF;
 IF (SELECT count(*) FROM crm_private.drive_resume_import_ledger)<>1
 THEN RAISE EXCEPTION 'emergency hold dropped ledger'; END IF;
END $stop$;
SQL
echo 'PASS: Drive emergency revoke disables API but preserves original ledger'
