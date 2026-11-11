import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withCandidateSyncLease,createSupabaseSyncLeaseOperations} from '../../src/lib/sync-lease.server.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=p=>readFileSync(resolve(root,p),'utf8');
const owner='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const tokenA='11111111-1111-4111-8111-111111111111';
const tokenB='22222222-2222-4222-8222-222222222222';
function lease() {
 let active=null; const events=[];
 return {events,
 claim:async(id,t)=>{events.push('claim');if(active)return false;active={id,t};return true},
 renew:async(id,t)=>{events.push('renew');return active?.id===id&&active?.t===t},
 release:async(id,t)=>{events.push('release');if(active?.id!==id||active?.t!==t)return false;active=null;return true}};
}
test('success confirms claim, heartbeats and release',async()=>{
 const ops=lease();const got=await withCandidateSyncLease(owner,async(heartbeat)=>{await heartbeat();return 42},ops,()=>tokenA);
 assert.deepEqual(got,{acquired:true,value:42});
 assert.deepEqual(ops.events,['claim','renew','renew','renew','release']);
});
test('concurrent same-owner worker is not executed',async()=>{
 const ops=lease();let go;let started;
 const ready=new Promise(r=>started=r),hold=new Promise(r=>go=r);let runs=0;
 const first=withCandidateSyncLease(owner,async()=>{runs++;started();await hold;return 10},ops,()=>tokenA);
 await ready;
 assert.deepEqual(await withCandidateSyncLease(owner,async()=>{runs++;return 20},ops,()=>tokenB),{acquired:false});
 assert.equal(runs,1);
 go();assert.deepEqual(await first,{acquired:true,value:10});
 assert.deepEqual(await withCandidateSyncLease(owner,async()=>{runs++;return 30},ops,()=>tokenB),{acquired:true,value:30});
});
test('invalid owner never claims',async()=>{
 const ops=lease();await assert.rejects(withCandidateSyncLease('not-uuid',async()=>1,ops,()=>tokenA),/Invalid candidate sync owner/);
 assert.equal(ops.events.length,0);
});
test('invalid nonce never claims',async()=>{
 const ops=lease();await assert.rejects(withCandidateSyncLease(owner,async()=>1,ops,()=>''),/Invalid lease token/);
 assert.equal(ops.events.length,0);
});
test('missing claim privilege fails before worker runs',async()=>{
 let runs=0;const ops=lease();ops.claim=async()=>{throw Error('No RPC')};
 await assert.rejects(withCandidateSyncLease(owner,async()=>{runs++;return 10},ops,()=>tokenA),/No RPC/);
 assert.equal(runs,0);
});
test('lost initial lease prevents any worker data access',async()=>{
 let runs=0;const ops=lease();ops.renew=async()=>false;
 await assert.rejects(withCandidateSyncLease(owner,async()=>{runs++;return 10},ops,()=>tokenA),/lease lost/);
 assert.equal(runs,0);assert.equal(ops.events.at(-1),'release');
});
test('lost heartbeat during worker blocks successful completion',async()=>{
 const ops=lease();let count=0;ops.renew=async()=>++count===1;
 await assert.rejects(withCandidateSyncLease(owner,async(renew)=>{await renew();return 10},ops,()=>tokenA),/lease lost/);
 assert.equal(ops.events.at(-1),'release');
});
test('worker exception still releases lease',async()=>{
 const ops=lease();
 await assert.rejects(withCandidateSyncLease(owner,async()=>{throw Error('synthetic')},ops,()=>tokenA),/synthetic/);
 assert.equal(ops.events.at(-1),'release');
});
test('failed release never returns successful outcome',async()=>{
 const ops=lease();ops.release=async()=>false;
 await assert.rejects(withCandidateSyncLease(owner,async()=>1,ops,()=>tokenA),/release could not be confirmed/);
});
test('unavailable release RPC fails closed',async()=>{
 const ops=lease();ops.release=async()=>{throw Error('disconnected')};
 await assert.rejects(withCandidateSyncLease(owner,async()=>1,ops,()=>tokenA),/release could not be confirmed/);
});
test('fixed RPC function names and same owner/token are used',async()=>{
 const rows=[];const client={rpc:async(name,parameters)=>{rows.push({name,parameters});return {data:true,error:null}}};
 const ops=createSupabaseSyncLeaseOperations(client);
 assert.equal(await ops.claim(owner,tokenA),true);
 assert.equal(await ops.renew(owner,tokenA),true);
 assert.equal(await ops.release(owner,tokenA),true);
 assert.deepEqual(rows.map(x=>x.name),['crm_claim_candidate_sync_lease','crm_refresh_candidate_sync_lease','crm_release_candidate_sync_lease']);
 for(const row of rows)assert.deepEqual(row.parameters,{p_owner:owner,p_token:tokenA});
});
for(const failure of [{data:null,error:null},{data:'true',error:null},{data:true,error:{message:'denied'}}]){
 test('RPC malformed/error data cannot authorize lease',async()=>{
  const ops=createSupabaseSyncLeaseOperations({rpc:async()=>failure});
  await assert.rejects(ops.claim(owner,tokenA),/RPC unavailable/);
 });
}
test('importer checks lease at candidate write checkpoints',()=>{
 const code=source('src/lib/sheets-sync.server.ts');
 assert.match(code,/leaseHeartbeat\?: \(\) => Promise<void>/);
 assert.match(code,/await opts\.leaseHeartbeat\?\.\(\);\s*const \{ error \} = await \(supabaseAdmin\.from\("candidates"\)/);
 assert.match(code,/await opts\.leaseHeartbeat\?\.\(\);\s*const \{ data: ins, error \} = await \(supabaseAdmin\.from\("candidates"\)/);
 assert.ok((code.match(/await opts\.leaseHeartbeat\?\.\(\);/g)||[]).length>=6);
});
test('route acquires owner lease and passes heartbeat to importer',()=>{
 const code=source('src/routes/api/public/hooks/sheets-sync.ts');
 assert.match(code,/withCandidateSyncLease\(/);
 assert.match(code,/createSupabaseSyncLeaseOperations\(supabaseAdmin as any\)/);
 assert.match(code,/leaseHeartbeat: heartbeat/);
 assert.match(code,/if \(!execution\.acquired\) throw/);
});
test('SQL revokes public rights, fixes search_path and grants only service role',()=>{
 const code=source('security/build37/sync-lease-review-only.sql');
 assert.match(code,/SECURITY DEFINER SET search_path = pg_catalog/);
 assert.match(code,/owner_id uuid PRIMARY KEY/);
 for(const fn of ['claim','refresh','release']){
  assert.ok(code.includes('REVOKE EXECUTE ON FUNCTION public.crm_'+fn+'_candidate_sync_lease(uuid,uuid) FROM PUBLIC, anon, authenticated'));
  assert.ok(code.includes('GRANT EXECUTE ON FUNCTION public.crm_'+fn+'_candidate_sync_lease(uuid,uuid) TO service_role'));
 }
});
