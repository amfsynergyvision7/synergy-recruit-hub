import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const rows=read('src/lib/sheets-sync.server.ts');
const lease=read('src/lib/sync-lease.server.ts');
const route=read('src/routes/api/public/hooks/sheets-sync.ts');
const sql=read('security/build43/candidate-row-commit-review-only.sql');
const rehearsal=read('security/build43/atomic-row-commit.integration.sql');

test('scheduled route passes the unforgeable acquired lease token into atomic sync',()=>{
 assert.match(route,/\(heartbeat, token\) => runCandidateSync/);
 assert.match(route,/leaseToken: token, atomicRowWrites: true/);
});
test('lease callback receives the same token used for claim, refresh and release',()=>{
 assert.match(lease,/work: \(heartbeat: \(\) => Promise<void>, token: string\)/);
 assert.match(lease,/result = await work\(heartbeat, token\)/);
});
test('atomic preflight denies absent lease token and heartbeat before spreadsheet read',()=>{
 const first=rows.indexOf('if (opts.atomicRowWrites &&');
 const second=rows.indexOf('const integ = await getSavedGoogleIntegration');
 assert.ok(first>=0&&first<second);
 assert.match(rows,/Atomic sync requires owner, lease token and heartbeat/);
});
test('scheduled candidate import invokes exactly one fenced transaction RPC per row',()=>{
 assert.match(rows,/\.rpc\(\s*"crm_commit_candidate_sync_row"/);
 for(const field of ['p_owner','p_token','p_integration','p_row_number','p_candidate'])
  assert.ok(rows.includes(field+':'));
 assert.match(rows,/if \(commitError \|\| !Array\.isArray\(committed\) \|\| committed\.length !== 1\)/);
 assert.match(rows,/throw new Error\("Atomic candidate sync commit unavailable"\)/);
});
test('atomic scheduler cannot overwrite the database-committed cursor',()=>{
 assert.match(rows,/\.\.\.\(!opts\.atomicRowWrites \? \{ last_synced_row: lastSynced \} : \{\}\)/);
});
test('review-only SQL requires the current authorized owner and live lease',()=>{
 assert.match(sql,/p\.status='approved' AND p\.is_active IS TRUE AND r\.role='admin'/);
 assert.match(sql,/lease_token=p_token AND l\.expires_at>clock_timestamp\(\)/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/expired during row commit/);
});
test('one transaction covers candidate insert/update, notification, ledger and cursor',()=>{
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/INSERT INTO public\.candidates\(/);
 assert.match(sql,/UPDATE public\.candidates c SET/);
 assert.match(sql,/INSERT INTO public\.notifications/);
 assert.match(sql,/INSERT INTO crm_private\.candidate_sync_row_ledger/);
 assert.match(sql,/SET last_synced_row=p_row_number/);
 assert.match(sql,/COMMIT;/);
});
test('replays reject edited source rows, cursor gaps and changed source identity',()=>{
 assert.match(sql,/payload_fingerprint<>v_fingerprint/);
 assert.match(sql,/Existing imported row changed/);
 assert.match(sql,/Non-contiguous cursor/);
 assert.match(sql,/Prior sync cursor\/source unverified/);
});
test('candidate owner fields are excluded from the JSON allowlist',()=>{
 assert.match(sql,/Unsupported candidate keys/);
 assert.ok(!sql.includes("'assigned_recruiter'"));
 assert.ok(!sql.includes("p_candidate->>'candidate_code'"));
});
test('function is service-role-only and ledger is private',()=>{
 assert.match(sql,/REVOKE ALL ON SCHEMA crm_private FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.crm_commit_candidate_sync_row/);
 assert.match(sql,/TO service_role/);
});
test('rollback fixture injects failure after candidate write and checks no partial artifacts',()=>{
 for(const phrase of ['injected notification failure','postfailure candidate persisted','postfailure ledger persisted','postfailure cursor moved','sync duplicated notification','expired lease committed','no_remaining_ledger']){
  assert.ok(rehearsal.includes(phrase),phrase);
 }
});
test('scheduler remains disabled by default without cron secret and flags',()=>{
 assert.match(route,/enabled: process\.env\.SHEETS_SYNC_CRON_ENABLED/);
 assert.match(route,/secret: process\.env\.CRON_SECRET/);
});
