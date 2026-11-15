#!/usr/bin/env bash
# BUILD158 ephemeral PG17 service ONLY. No production secrets, real messages or recipients.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "amf_build158_email_lab" ]]; then
 echo "BUILD158 STOP: not the approved disposable test database" >&2
 exit 3
fi
if [[ "${BUILD158_CI_DISPOSABLE:-}" != "true" ]]; then
 echo "BUILD158 STOP: disposable CI marker missing" >&2
 exit 3
fi
ROOT="security/build158-email-outbox"
psql -X -v ON_ERROR_STOP=1 -f "$ROOT/disposable-pg17-concurrent-setup.sql" >/dev/null
cleanup() { psql -X -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS public.email_log" >/dev/null || true; }
first_log="$(mktemp)"
second_log="$(mktemp)"
trap 'rm -f "$first_log" "$second_log"; cleanup' EXIT
# Tx 1 leaves the insert uncommitted for 2 seconds; competing Tx 2 is a
# separate database connection/actor with a new UUID for the same recipient.
psql -X -v ON_ERROR_STOP=1 -c "
BEGIN;
INSERT INTO public.email_log
 (id,related_table,related_id,to_email,status,sent_by)
VALUES ('11111111-1111-4111-8111-111111111111',
 'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'candidate@invalid.test','pending',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SELECT pg_sleep(2);
COMMIT;" >"$first_log" 2>&1 &
first_pid=$!
sleep 0.3
psql -X -v ON_ERROR_STOP=1 -c "
INSERT INTO public.email_log
 (id,related_table,related_id,to_email,status,sent_by)
VALUES ('22222222-2222-4222-8222-222222222222',
 'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 ' CANDIDATE@INVALID.test ','pending',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');" >"$second_log" 2>&1 &
second_pid=$!
wait "$first_pid"
set +e
wait "$second_pid"
second_exit=$?
set -e
if [[ "$second_exit" -eq 0 ]]; then
 echo "BUILD158 FAIL: a second unresolved record was inserted" >&2
 exit 1
fi
if ! grep -Fq 'email_log_one_unresolved_per_recipient_idx' "$second_log"; then
 echo "BUILD158 FAIL: second transaction failed for unexpected reason" >&2
 exit 1
fi
count="$(psql -X -A -t -v ON_ERROR_STOP=1 -c "
SELECT count(*) FROM public.email_log WHERE related_table='candidates'
 AND related_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND status='pending'")"
if [[ "$count" != "1" ]]; then
 echo "BUILD158 FAIL: expected exactly one pending attempt" >&2
 exit 1
fi
echo "BUILD158 verified: competing transaction rejected; exactly one pending record"
