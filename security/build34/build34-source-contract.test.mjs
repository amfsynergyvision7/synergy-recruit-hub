import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCandidateSyncCron, hasValidCronBearer } from '../../src/lib/cron-auth.server.ts';
import { isApprovedActiveWithRole } from '../../src/lib/approved-role-policy.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const file=(p)=>readFileSync(resolve(root,p),'utf8');
const secret='synthetic-not-a-real-secret-long-enough-123456';
function request(h,method='POST') { return new Request('https://invalid.example.test/hooks',{method,headers:h?{Authorization:h}:{}}); }
function fixture(integration={auto_sync_enabled:true,spreadsheet_id:'synthetic'}) {
 const calls={integration:0,sync:0,log:0};
 const deps={getIntegration:async()=>{calls.integration++;return integration;},runSync:async()=>{calls.sync++;return {created:1};},recordFailure:async()=>{calls.log++;}};
 return {calls,deps};
}
for(const conf of [undefined,'','short','contains a space','x'.repeat(1025)]) {
 test('invalid secret rejects before I/O',async()=>{
  const {calls,deps}=fixture();const res=await handleCandidateSyncCron(request('Bearer '+secret),conf,deps);
  assert.equal(res.status,503);assert.deepEqual(calls,{integration:0,sync:0,log:0});
 });
}
for(const h of [null,'Bearer wrong','Basic '+secret,'bearer '+secret,'Bearer ','Bearer '+('X'.repeat(2048))]){
 test('invalid bearer rejects before I/O',async()=>{
  const {calls,deps}=fixture();assert.equal(hasValidCronBearer(h,secret),false);
  const res=await handleCandidateSyncCron(request(h),secret,deps);
  assert.equal(res.status,401);assert.equal(res.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,{integration:0,sync:0,log:0});
 });
}
test('GET is denied without calling sync',async()=>{
 const {calls,deps}=fixture();assert.equal((await handleCandidateSyncCron(request('Bearer '+secret,'GET'),secret,deps)).status,405);assert.equal(calls.sync,0);
});
test('disabled integration skips mutation',async()=>{
 const {calls,deps}=fixture({auto_sync_enabled:false,spreadsheet_id:'synthetic'});
 assert.equal((await handleCandidateSyncCron(request('Bearer '+secret),secret,deps)).status,200);assert.equal(calls.sync,0);
});
test('valid injected synthetic operation runs once',async()=>{
 const {calls,deps}=fixture();assert.equal((await handleCandidateSyncCron(request('Bearer '+secret),secret,deps)).status,200);
 assert.deepEqual(calls,{integration:1,sync:1,log:0});
});
test('private exceptions do not leak',async()=>{
 const {calls,deps}=fixture();deps.runSync=async()=>{calls.sync++;throw Error('private-not-for-http');};
 const res=await handleCandidateSyncCron(request('Bearer '+secret),secret,deps);
 assert.equal(res.status,500);assert.doesNotMatch(await res.text(),/private-not-for-http/);assert.equal(calls.log,1);
});
for(const [profile,roles,allowed,expected] of [
 [{status:'approved',is_active:true},[{role:'admin'}],['admin'],true],
 [{status:'pending',is_active:true},[{role:'admin'}],['admin'],false],
 [{status:'approved',is_active:false},[{role:'admin'}],['admin'],false],
 [{status:'rejected',is_active:true},[{role:'admin'}],['admin'],false],
 [null,[{role:'admin'}],['admin'],false],
 [{status:'approved',is_active:true},null,['admin'],false],
 [{status:'approved',is_active:true},[{role:'operations'}],['admin','recruiter'],false],
 [{status:'approved',is_active:true},[{role:'finance'}],['admin','recruiter'],false],
]){
 test('approved/active/role matrix',()=>assert.equal(isApprovedActiveWithRole(profile,roles,allowed),expected));
}
test('actual webhook route uses server-owned secret',()=>{
 const s=file('src/routes/api/public/hooks/sheets-sync.ts');
 assert.match(s,/handleCandidateSyncCron\(request, process\.env\.CRON_SECRET/);
 assert.match(s,/getSavedGoogleIntegration\(\{ backfillLegacy: false \}\)/);
});
test('server gate reads trusted profile and roles',()=>{
 const s=file('src/lib/access-gates.server.ts');
 assert.match(s,/\.from\('profiles'\)\.select\('status,is_active'\)/);
 assert.match(s,/\.from\('user_roles'\)\.select\('role'\)/);
 assert.doesNotMatch(s,/raw_user_meta_data|user_metadata/);
});
test('six AI/import routes each have a server role gate',()=>{
 const s=file('src/lib/ai.functions.ts');
 assert.equal((s.match(/await assertApprovedRole\(context\.userId,/g)||[]).length,6);
});
