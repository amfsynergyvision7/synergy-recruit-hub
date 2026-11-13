import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executionPlan,validateSnapshot,runGuardedHostUat,MANUAL_CONFIRMATION,PREFLIGHT_CONFIRMATION,BASE_COUNTS} from './run-once.mjs';
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
  AMF_UAT_PASSWORD_MASTER_SECRET:'amf_uat_master_'+ 'm'.repeat(70),
  AMF_UAT_MAPPING_FILE:'/tmp/synthetic-uat-in-memory-mapping.json'
 };
 // Passwords are deterministically derived from the protected test-only master.
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
 assert.equal(new Set(ok.credentials.users.map(u=>u.password)).size,9);
 assert.deepEqual(ok.credentials.users.map(u=>u.password),executionPlan(env()).credentials.users.map(u=>u.password));
 assert(ok.credentials.users.every(u=>u.password.length>=40&&!u.password.includes(env().AMF_UAT_PASSWORD_MASTER_SECRET)));
 for(const variation of [
  {AMF_UAT_PROJECT_ID:'wusntntcqgtpgokggdzv'},
  {AMF_UAT_SUPABASE_URL:'https://wusntntcqgtpgokggdzv.supabase.co'},
  {AMF_UAT_OPERATION:'PRODUCTION'},
  {AMF_UAT_CONFIRMATION:'yes'},
  {AMF_UAT_SERVICE_ROLE_KEY:'sb_publishable_not_admin'},
  {AMF_UAT_MAPPING_FILE:'./mapping.json'},
  {AMF_UAT_PASSWORD_MASTER_SECRET:'weak'}
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
 const guarded=executionPlan({...env(),AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38',AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION});
 await assert.rejects(runGuardedHostUat(guarded,client),/Auth/);
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
 assert(workflow.includes('preflight_confirmation:'));
 assert(workflow.includes('AMF_UAT_PREFLIGHT_ATTESTATION:'));
 assert(workflow.includes('I_REVIEWED_FRESH_NONPROD_SQL_19_EMPTY_ZERO_AUTH_TRIGGERS_GRANTS_POLICIES'));
 assert(workflow.includes('AMF_UAT_PASSWORD_MASTER_SECRET'));
 assert(!workflow.includes('secrets.AMF_UAT_CASE_'));
 assert(!workflow.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'));
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


test('BUILD88 cannot create nine GoTrue users without a separately reviewed, fresh SQL preflight attestation',()=>{
 const e={...env(),AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38'};
 assert.throws(()=>executionPlan(e),/preflight attestation/);
 assert.throws(()=>executionPlan({...e,AMF_UAT_PREFLIGHT_ATTESTATION:'I clicked YES'}),/preflight attestation/);
 const ok=executionPlan({...e,AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION});
 assert.equal(ok.operation,'CREATE_NINE_AND_SEED_38');
 assert.equal(ok.credentials.users.length,9);
});
test('BUILD88 direct-runner rejects arbitrary operations and missing nonprod credentials without API writes',async()=>{
 const f=fakeClient();
 await assert.rejects(runGuardedHostUat({operation:'WRONG'},f.client),/Unknown isolated hosted operation/);
 await assert.rejects(runGuardedHostUat({operation:'CREATE_NINE_AND_SEED_38'},f.client),/Invalid exact nonproduction synthetic plan/);
 assert.equal(f.mutated(),false);
});
test('BUILD88 read-only SQL preflight inspects all 19 app tables plus Auth triggers, public grants and RLS',()=>{
 const sql=readFileSync(new URL('./build88-hosted-preflight.readonly.sql',import.meta.url),'utf8');
 for(const table of Object.keys(expectedTables)){
   assert(sql.includes('FROM public.'+table),'missing source table '+table);
 }
 assert.equal((sql.match(/AS row_count FROM public\./g)||[]).length,19);
 for(const item of ['FROM auth.users','enabled_auth_user_triggers','enabled_app_triggers',
  'public_rls_policies','public_tables_with_caller_grants','callable_public_functions',
  'exposed_public_views','unprotected_public_tables','ready_for_reviewed_synthetic_provisioning']){
   assert(sql.includes(item),'missing safety audit '+item);
 }
 assert(!/\b(?:insert|update|delete|create|drop|alter|truncate)\s+(?:into\s+|from\s+)?(?:public|auth)\./i.test(sql));
});
test('BUILD88 GitHub manual workflow requires fresh preflight only for write operation, not audit',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 const guard=workflow.slice(workflow.indexOf('  manual_provisioning:'));
 assert(guard.includes("inputs.operation == 'AUDIT_ONLY' ||"));
 assert(guard.includes('inputs.preflight_confirmation == '));
 assert(guard.includes('AMF_UAT_PREFLIGHT_ATTESTATION:'));
 assert(guard.includes('github.ref == '));
 assert(!guard.includes('pull_request:'));
});
