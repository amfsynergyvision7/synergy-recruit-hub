import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executionPlan,validateSnapshot,runGuardedHostUat,MANUAL_CONFIRMATION,BASE_COUNTS} from './run-once.mjs';
import {EXPECTED_EXTENDED_COUNTS,composeExtendedFixture} from './compose-and-seed-remaining-fixture.mjs';

const project='dhlhlasnaapzckjyvffn';
const env=()=>{
 const e={
  AMF_UAT_OPERATION:'AUDIT_ONLY',
  AMF_UAT_CONFIRMATION:MANUAL_CONFIRMATION,
  AMF_UAT_MODE:'EXECUTE',
  AMF_UAT_ACK:'I_ACCEPT_ISOLATED_SYNTHETIC_AUTH_ADMIN_NONPROD_ONLY',
  AMF_UAT_PROJECT_ID:project,
  AMF_UAT_SUPABASE_URL:'https://'+project+'.supabase.co',
  AMF_UAT_SERVICE_ROLE_KEY:'sb_secret_'+ 'S'.repeat(24),
  AMF_UAT_MAPPING_FILE:'/tmp/synthetic-uat-in-memory-mapping.json'
 };
 for(let i=1;i<=9;i++)e['AMF_UAT_CASE_'+String(i).padStart(2,'0')+'_PASSWORD']='TestSyntheticOnly-'+i+'-Strong-Pass4';
 return e;
};
const expectedTables={...BASE_COUNTS,...EXPECTED_EXTENDED_COUNTS};
const snapshot=(stage)=>{
 const count={};
 for(const k of Object.keys(expectedTables))
   count[k]=stage==='EMPTY'?0:stage==='BASE'?(BASE_COUNTS[k]??0):expectedTables[k];
 return {authUsers:stage==='EMPTY'?0:9,tableCounts:count,
  totalRows:Object.values(count).reduce((a,b)=>a+b,0)};
};
const fakeClient=(counts=snapshot('EMPTY'))=>{
 let mutated=false;
 const client={
  auth:{admin:{listUsers:async()=>({data:{users:Array.from({length:counts.authUsers},(_,i)=>({id:'synthetic-'+i}))}}),
    createUser:async()=>{mutated=true;throw new Error('unreachable');},
    deleteUser:async()=>{mutated=true;throw new Error('unreachable');}}},
  from:(table)=>({select:async()=>({count:counts.tableCounts[table],error:null})})
 };
 return {client,mutated:()=>mutated};
};
test('release runner accepts only exact project, nine unique passwords and explicit manual confirmation',()=>{
 const ok=executionPlan(env());
 assert.equal(ok.operation,'AUDIT_ONLY');
 assert.equal(ok.credentials.users.length,9);
 for(const variation of [
  {AMF_UAT_PROJECT_ID:'wusntntcqgtpgokggdzv'},
  {AMF_UAT_SUPABASE_URL:'https://wusntntcqgtpgokggdzv.supabase.co'},
  {AMF_UAT_OPERATION:'PRODUCTION'},
  {AMF_UAT_CONFIRMATION:'yes'},
  {AMF_UAT_SERVICE_ROLE_KEY:'sb_publishable_not_admin'},
  {AMF_UAT_MAPPING_FILE:'./mapping.json'},
  {AMF_UAT_CASE_03_PASSWORD:'short'}
 ])assert.throws(()=>executionPlan({...env(),...variation}));
});
test('all nineteen source-shaped table cardinalities sum to 38 and support exact stages',()=>{
 assert.equal(Object.keys(expectedTables).length,19);
 assert.equal(Object.values(BASE_COUNTS).reduce((a,b)=>a+b,0),18);
 assert.equal(Object.values(EXPECTED_EXTENDED_COUNTS).reduce((a,b)=>a+b,0),20);
 for(const stage of ['EMPTY','BASE','FULL'])
  assert.equal(validateSnapshot(snapshot(stage),stage),true);
});
test('refuse non-empty, wrong role or wrong count at each required stage',()=>{
 const e=snapshot('EMPTY');e.authUsers=1;
 assert.throws(()=>validateSnapshot(e,'EMPTY'),/Auth/);
 const b=snapshot('BASE');b.tableCounts.profiles=9;
 assert.throws(()=>validateSnapshot(b,'BASE'),/cardinality/);
 const f=snapshot('FULL');f.tableCounts.billing=2;
 assert.throws(()=>validateSnapshot(f,'FULL'),/cardinality/);
 assert.throws(()=>validateSnapshot(snapshot('EMPTY'),'UNKNOWN'),/stage/);
});
test('audit-only mode reads counts and performs zero Auth or CRM writes',async()=>{
 const {client,mutated}=fakeClient();
 const out=await runGuardedHostUat({operation:'AUDIT_ONLY'},client);
 assert.deepEqual(out,{operation:'AUDIT_ONLY',authUsers:0,records:0,mutated:false});
 assert.equal(mutated(),false);
});
test('write mode refuses a nonempty Auth tenant before account creation or fixture inserts',async()=>{
 const {client,mutated}=fakeClient({...snapshot('EMPTY'),authUsers:1});
 await assert.rejects(runGuardedHostUat({operation:'CREATE_NINE_AND_SEED_38'},client),/Auth/);
 assert.equal(mutated(),false);
});
test('no public endpoint, automatic schedule, prod secret or prod database source in manual runner',()=>{
 const code=readFileSync(new URL('./run-once.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(workflow.includes('workflow_dispatch:'));
 assert(workflow.includes("github.ref == 'refs/heads/main'"));
 assert(workflow.includes("github.actor == 'amfsynergyvision7'"));
 assert(workflow.includes('name: amf-nonprod-auth-review'));
 assert(workflow.includes('AMF_NONPROD_SERVICE_ROLE_KEY'));
 assert(!workflow.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'));
 assert(!workflow.includes('schedule:'));
 assert(!workflow.includes('push:'));
 assert(!workflow.includes('wusntntcqgtpgokggdzv'));
 assert(!workflow.includes('supabase_admin'));
 assert(code.includes("validateSnapshot(before,'EMPTY')"));
 assert(code.includes("validateSnapshot(await readHostedSnapshot(client),'FULL')"));
 assert(!/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?auth\.users\b/i.test(code));
});
test('nine invalid-domain Auth users and sixteen inert fixtures preserve no real contact and no workflow activation',()=>{
 const auth=readFileSync(new URL('./provision-nine-auth-users.mjs',import.meta.url),'utf8');
 const fixture=readFileSync(new URL('./compose-and-seed-remaining-fixture.mjs',import.meta.url),'utf8');
 assert(auth.includes('@example.invalid'));
 assert(auth.includes('email_confirm: true'));
 assert(!auth.includes('inviteUserByEmail('));
 assert(fixture.includes("is_active:false"));
 assert(fixture.includes("auto_sync_enabled:false"));
 assert(fixture.includes("status:'synthetic_never_sent'"));
 assert(fixture.includes("invoice_number:null"));
 assert(fixture.includes("status:'never_run'"));
 assert(fixture.includes('populatedExtendedTables:16'));
});
