import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
import {makeBatchReport} from './batch-ci-report.mjs';
const dir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
const release=JSON.parse(readFileSync(fileURLToPath(new URL('./release-evidence.json',import.meta.url)),'utf8'));
const triage=bulkMigrationTriage(dir);
const green={'application-typescript-check':'success','offline-security-tests':'success','isolated-postgres-view-rls':'success'};
test('green CI produces 10 disposable rehearsals, 16 blocked, HOLD and no release gates',()=>{
 const r=makeBatchReport({triage,release,jobResults:green,sha:'synthetic',runId:'synthetic'});
 assert.equal(r.verification,'DISPOSABLE_CI_JOBS_PASSED');
 assert.equal(r.ci_verified_replays,10);assert.equal(r.blocked_files.length,16);
 assert.equal(r.release_gates_passed,0);assert.equal(r.status,'HOLD');
});
test('failed or skipped CI cannot claim verified migration replay',()=>{
 for(const state of ['failure','cancelled','skipped','unknown']){
  const r=makeBatchReport({triage,release,jobResults:{...green,'isolated-postgres-view-rls':state}});
  assert.equal(r.ci_verified_replays,0);assert.equal(r.verification,'NOT_VERIFIED');
 }
});
test('release gate changes and migration inventory drift fail closed',()=>{
 const changed=structuredClone(release);changed.release_approved.passed=true;
 assert.throws(()=>makeBatchReport({triage,release:changed,jobResults:green}),/HOLD/);
 assert.throws(()=>makeBatchReport({triage:{...triage,total:25},release,jobResults:green}),/inventory/);
});
