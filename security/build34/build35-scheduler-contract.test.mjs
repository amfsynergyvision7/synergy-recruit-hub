import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCandidateSyncCron, hasValidCronBearer, isValidSyncOwnerId } from '../../src/lib/cron-auth.server.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=p=>readFileSync(resolve(root,p),'utf8');
const secret='synthetic-only-no-real-credential-1234567890';
const owner='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const wrongOwner='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const cfg={secret,enabled:'true',ownerUserId:owner};
function req(token=secret,method='GET'){
 return new Request('https://example.invalid/hooks',{method,headers:token===null?{}:{authorization:'Bearer '+token}});
}
function fixture(integration={user_id:owner,auto_sync_enabled:true,spreadsheet_id:'synthetic'}){
 const calls={role:0,integration:0,sync:0,logs:0};
 const deps={
  assertOwnerAdmin:async(id)=>{calls.role++;assert.equal(id,owner);},
  getIntegration:async(id)=>{calls.integration++;assert.equal(id,owner);return integration;},
  runSync:async(id)=>{calls.sync++;assert.equal(id,owner);return {created:1,updated:2,skipped:3,errors:0};},
  recordFailure:async()=>{calls.logs++;}
 };
 return {calls,deps};
}
for(const bad of [
 {...cfg,enabled:undefined},{...cfg,enabled:'false'},{...cfg,enabled:'TRUE'},
 {...cfg,ownerUserId:undefined},{...cfg,ownerUserId:'not-uuid'},
 {...cfg,secret:undefined},{...cfg,secret:'short'},{...cfg,secret:secret+' '}
]){
 test('missing or unsafe configuration denies all integration access',async()=>{
  const {calls,deps}=fixture();const response=await handleCandidateSyncCron(req(),bad,deps);
  assert.equal(response.status,503);assert.deepEqual(calls,{role:0,integration:0,sync:0,logs:0});
 });
}
for(const bad of [null,'wrong','','bad'+secret]){
 test('invalid bearer denied before I/O',async()=>{
  const {calls,deps}=fixture();
  assert.equal((await handleCandidateSyncCron(req(bad),cfg,deps)).status,401);
  assert.deepEqual(calls,{role:0,integration:0,sync:0,logs:0});
 });
}
for(const method of ['PUT','DELETE','PATCH','HEAD']){
 test('forbidden method denies all I/O',async()=>{
  const {calls,deps}=fixture();
  assert.equal((await handleCandidateSyncCron(req(secret,method),cfg,deps)).status,405);
  assert.deepEqual(calls,{role:0,integration:0,sync:0,logs:0});
 });
}
for(const method of ['GET','POST']){
 test('trusted scheduler method passes stable owner and sanitizes counts',async()=>{
  const {calls,deps}=fixture();const response=await handleCandidateSyncCron(req(secret,method),cfg,deps);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,created:1,updated:2,skipped:3});
  assert.deepEqual(calls,{role:1,integration:1,sync:1,logs:0});
 });
}
for(const integration of [
 null,{user_id:owner,auto_sync_enabled:false,spreadsheet_id:'synthetic'},
 {user_id:owner,auto_sync_enabled:true,spreadsheet_id:null}
]){
 test('no enabled spreadsheet returns no writes',async()=>{
  const {calls,deps}=fixture(integration);
  const response=await handleCandidateSyncCron(req(),cfg,deps);
  assert.equal(response.status,200);assert.equal(calls.sync,0);
 });
}
test('cross-owner integration rejected without sync',async()=>{
 const {calls,deps}=fixture({user_id:wrongOwner,auto_sync_enabled:true,spreadsheet_id:'synthetic'});
 const response=await handleCandidateSyncCron(req(),cfg,deps);
 assert.equal(response.status,500);assert.equal(calls.sync,0);
});
test('suspended owner denied before lookup',async()=>{
 const {calls,deps}=fixture();
 deps.assertOwnerAdmin=async()=>{calls.role++;throw Error('suspended');};
 assert.equal((await handleCandidateSyncCron(req(),cfg,deps)).status,500);assert.equal(calls.integration,0);
});
test('partial result cannot masquerade as successful sync',async()=>{
 const {deps}=fixture();
 deps.runSync=async()=>({created:1,updated:0,skipped:1,errors:1,error_details:[{message:'private candidate'}]});
 const response=await handleCandidateSyncCron(req(),cfg,deps);
 assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/private candidate/);
});
test('successful result strips provider details',async()=>{
 const {deps}=fixture();
 deps.runSync=async()=>({created:1,updated:0,skipped:0,errors:0,diagnostics:{message:'hidden'},error_details:[{message:'hidden'}]});
 const response=await handleCandidateSyncCron(req(),cfg,deps);
 assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/hidden|error_details|diagnostics/);
});
test('provider and log errors stay private',async()=>{
 const {deps}=fixture();
 deps.getIntegration=async()=>{throw Error('private provider info')};
 deps.recordFailure=async()=>{throw Error('private log info')};
 const response=await handleCandidateSyncCron(req(),cfg,deps);
 assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/private/);
});
test('owner ID must be UUID',()=>{
 assert.equal(isValidSyncOwnerId(owner),true);
 for(const bad of ['',null,undefined,'notuuid','0'.repeat(32)])assert.equal(isValidSyncOwnerId(bad),false);
});
test('authorization header must match exactly including no trailing newline',()=>{
 assert.equal(hasValidCronBearer('Bearer '+secret,secret),true);
 assert.equal(hasValidCronBearer('Bearer '+secret+'\n',secret),false);
});
test('source binds owner for read, role and mutation, and supports GET',()=>{
 const code=source('src/routes/api/public/hooks/sheets-sync.ts');
 assert.match(code,/SHEETS_SYNC_OWNER_USER_ID/);
 assert.match(code,/SHEETS_SYNC_CRON_ENABLED/);
 assert.match(code,/assertApprovedRole\(ownerId, \['admin'\]\)/);
 assert.match(code,/getSavedGoogleIntegration\(\{ backfillLegacy: false, userId: ownerId \}\)/);
 assert.match(code,/runCandidateSync\(\{ triggeredBy: 'cron', userId: ownerId, leaseHeartbeat: heartbeat, leaseToken: token, atomicRowWrites: true \}\)/);
 assert.match(code,/GET: handler, POST: handler/);
});
