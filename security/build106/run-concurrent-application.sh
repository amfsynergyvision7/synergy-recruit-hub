#!/usr/bin/env bash
# Disposable PostgreSQL 17 ONLY. No network access to Supabase or production.
set -euo pipefail
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres
db="b106_${GITHUB_RUN_ID:-local}_${GITHUB_RUN_ATTEMPT:-1}"
[[ "$db" =~ ^b106_[0-9A-Za-z_]+$ ]] || { echo 'Unsafe disposable DB name'; exit 1; }
tmp="$(mktemp -d)"
cleanup() {
  # Always clean the temporary database and output files, even on failure.
  dropdb --if-exists --force "$db" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
# No table writes in the shared PostgreSQL service's postgres database.
createdb -T template0 "$db"
node security/build105/compose-source-shaped-public-application.mjs
node security/build106/compose-concurrent-application.mjs
psql -X -v ON_ERROR_STOP=1 -d "$db" -f /tmp/amf-build106-concurrent-setup.sql >"$tmp/setup.log" 2>&1 || {
  cat "$tmp/setup.log"; exit 1;
}
job='11111111-1111-4111-8111-111111111111'
invoke() {
  local proof="$1" email="$2" phone="$3" out="$4"
  # No real identities: all inputs are hard-coded fictitious .invalid addresses.
  psql -X -At -v ON_ERROR_STOP=1 -d "$db" \
    -c "SET ROLE service_role; SELECT public.crm_commit_verified_public_application('$proof','$job','Synthetic Concurrent Applicant','$email','$phone');" \
    >"$out" 2>&1 &
  pid=$!
}
pair() {
  local category="$1" proof1="$2" email1="$3" phone1="$4" proof2="$5" email2="$6" phone2="$7"
  local a="$tmp/${category}_a" b="$tmp/${category}_b"
  invoke "$proof1" "$email1" "$phone1" "$a"; local p1=$pid
  invoke "$proof2" "$email2" "$phone2" "$b"; local p2=$pid
  local s1=0 s2=0
  wait "$p1" || s1=$?
  wait "$p2" || s2=$?
  if [[ "$category" == "same_proof" ]]; then
    [[ "$s1" -eq 0 && "$s2" -eq 0 ]] || { cat "$a" "$b"; echo 'same-proof call failed'; exit 1; }
    local accepted replay
    accepted="$(grep -h -xc 'accepted' "$a" "$b" | awk -F: '{sum += $NF} END {print sum+0}')"
    replay="$(grep -h -xc 'already_applied' "$a" "$b" | awk -F: '{sum += $NF} END {print sum+0}')"
    [[ "$accepted" -eq 1 && "$replay" -eq 1 ]] || {
      cat "$a" "$b"; echo 'same-proof race inserted twice or missed replay'; exit 1;
    }
  else
    if [[ "$s1" -eq 0 && "$s2" -ne 0 ]]; then
      grep -q -x accepted "$a" && grep -q 'Application unavailable' "$b" || {
        cat "$a" "$b"; echo 'duplicate collision not rejected generically'; exit 1;
      }
    elif [[ "$s2" -eq 0 && "$s1" -ne 0 ]]; then
      grep -q -x accepted "$b" && grep -q 'Application unavailable' "$a" || {
        cat "$a" "$b"; echo 'duplicate collision not rejected generically'; exit 1;
      }
    else
      cat "$a" "$b"; echo 'duplicate contact race must have exactly one accepted claim'; exit 1
    fi
  fi
  echo "PASS Build106 concurrent ${category}: two sessions resolved without duplicate records"
}
# Same proof: second claimant waits on SELECT ... FOR UPDATE and must replay.
pair same_proof \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61' concurrent1@example.invalid 9876543161 \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61' concurrent1@example.invalid 9876543161
# Different proofs, same verified email: only one may be consumed.
pair same_email \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62' sharedemail@example.invalid 9876543162 \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa63' sharedemail@example.invalid 9876543163
# Different proofs, same verified mobile: only one may be consumed.
pair same_phone \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa64' different4@example.invalid 9876543164 \
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa65' different5@example.invalid 9876543164
psql -X -v ON_ERROR_STOP=1 -d "$db" -f security/build106/verify-concurrent-application.sql
echo 'PASS Build106: verified source-shaped CRM trigger concurrency, then disposing ephemeral database'
