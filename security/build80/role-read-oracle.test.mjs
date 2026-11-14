import test from 'node:test';
import assert from 'node:assert/strict';
import {
 READ_TABLES,PRIVATE_DENY_TABLES,FORBIDDEN_DIRECT_WRITES,
 testAccountId,syntheticAuthorizationFixture,expectedReadableRows,
 evaluateHistorical135,mayDirectlyMutateAnyCRMTable
} from './role-read-oracle.mjs';

const fixture=syntheticAuthorizationFixture();
const {rows,mapping,originalCases}=fixture;
const visible=(slot,table)=>expectedReadableRows(rows,mapping.users[slot-1].id,table);
const count=(slot,table)=>visible(slot,table).length;
const clone=()=>structuredClone(rows);

test('the exact 135 frozen read cases agree with the pure proposed role model',()=>{
 const result=evaluateHistorical135();
 assert.equal(result.expected_cases,135);
 assert.equal(result.pure_model_pass,135);
 assert.deepEqual(result.pure_model_failures,[]);
 assert.equal(result.simulated_go_true_sessions,0);
 assert.equal(result.actual_hosted_signed_cases,0);
 assert.equal(result.accepted_uat_cases,0);
 assert.equal(result.writes_attempted,0);
 assert.match(result.qualification,/OFFLINE_MODEL_ONLY/);
});

test('historical 15-table x nine-user rectangular scope is frozen and not a dynamic table grant',()=>{
 assert.equal(READ_TABLES.length,15);
 assert.equal(PRIVATE_DENY_TABLES.length,4);
 assert.equal(originalCases.length,135);
 for(let i=0;i<9;i++)for(let j=0;j<15;j++){
  const c=originalCases[i*15+j];
  assert.equal(c.table,READ_TABLES[j]);
  assert.equal(c.expected,count(i+1,c.table),c.case_id);
 }
});

test('admin reads the exact full source fixture admin historical table cardinalities',()=>{
 for(const t of READ_TABLES)assert.equal(count(1,t),rows[t].length,t);
 assert.equal(READ_TABLES.map(t=>count(1,t)).reduce((a,b)=>a+b,0),34);
});

test('recruiter 2 and 3 read only owned candidates, jobs, submissions and interviews',()=>{
 for(const [slot,other] of [[2,3],[3,2]]){
  const id=testAccountId(slot), otherId=testAccountId(other);
  for(const t of ['candidates','job_openings','submissions','interviews']){
   const got=visible(slot,t);
   assert.equal(got.length,1,t);
   assert.notEqual(got[0].candidate_id??got[0].id,otherId);
  }
  assert.equal(visible(slot,'candidates')[0].id,id);
  assert.equal(visible(slot,'notifications')[0].user_id,id);
  assert.equal(count(slot,'billing'),0);
  assert.equal(count(slot,'clients'),0);
  assert.equal(count(slot,'offers'),0);
 }
});

test('recruiters cannot read every other recruiter or finance, sync, Google integration, audit or client',()=>{
 const denied=['audit_logs','billing','candidate_activities','clients',
  'google_integrations','integrations','offers','sync_logs'];
 for(const slot of [2,3])for(const t of denied)assert.equal(count(slot,t),0,t);
});

test('finance has exactly one billing read and one self account/role',()=>{
 assert.equal(count(4,'billing'),1);
 assert.equal(count(4,'profiles'),1);
 assert.equal(count(4,'user_roles'),1);
 for(const t of READ_TABLES.filter(t=>!['billing','profiles','user_roles'].includes(t)))
  assert.equal(count(4,t),0,t);
});

test('operations and viewer are self-service-only in frozen 135-case proposal',()=>{
 for(const slot of [5,8]){
  assert.equal(count(slot,'profiles'),1);
  assert.equal(count(slot,'user_roles'),1);
  for(const t of READ_TABLES.filter(t=>!['profiles','user_roles'].includes(t)))
   assert.equal(count(slot,t),0,t);
 }
});

test('pending and inactive recruiters never see business records or notifications',()=>{
 for(const slot of [6,7]){
  assert.equal(count(slot,'profiles'),1);
  assert.equal(count(slot,'user_roles'),1);
  for(const t of READ_TABLES.filter(t=>!['profiles','user_roles'].includes(t)))
   assert.equal(count(slot,t),0,t);
 }
});

test('ninth GoTrue account without profile/role cannot read anything',()=>{
 for(const t of READ_TABLES)assert.equal(count(9,t),0,t);
});

test('all four omitted application tables remain default deny even for admin',()=>{
 for(const t of PRIVATE_DENY_TABLES)for(let slot=1;slot<=9;slot++)
  assert.equal(count(slot,t),0,`slot=${slot} table=${t}`);
});

test('an unknown table is rejected instead of inferred or treated as generic access',()=>{
 assert.throws(()=>expectedReadableRows(rows,testAccountId(1),'auth.users'),/Unknown/);
});

test('removing approval or active flag invalidates admin-wide and recruiter and finance access',()=>{
 for(const slot of [1,2,4]){
  for(const state of [{status:'pending',is_active:true},{status:'approved',is_active:false}]){
   const copy=clone();
   Object.assign(copy.profiles.find(p=>p.id===testAccountId(slot)),state);
   const table=slot===1?'candidates':slot===2?'candidates':'billing';
   assert.equal(expectedReadableRows(copy,testAccountId(slot),table).length,0);
   assert.equal(expectedReadableRows(copy,testAccountId(slot),'profiles').length,1);
  }
 }
});

test('missing or duplicate roles never create privileged access',()=>{
 const id=testAccountId(1);
 const none=clone();
 none.user_roles=none.user_roles.filter(r=>r.user_id!==id);
 assert.equal(expectedReadableRows(none,id,'profiles').length,0);
 assert.equal(expectedReadableRows(none,id,'candidates').length,0);
 const duplicate=clone();
 duplicate.user_roles.push({...duplicate.user_roles[0],id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',role:'finance'});
 assert.equal(expectedReadableRows(duplicate,id,'billing').length,0);
 assert.equal(expectedReadableRows(duplicate,id,'profiles').length,0);
});

test('mutating candidate ownership or linked candidate pointers denies inappropriate recruiters',()=>{
 const id=testAccountId(2);
 const copy=clone();
 copy.candidates.find(c=>c.id===id).assigned_recruiter=testAccountId(3);
 assert.equal(expectedReadableRows(copy,id,'candidates').length,0);
 assert.equal(expectedReadableRows(copy,id,'submissions').length,0);
 assert.equal(expectedReadableRows(copy,id,'interviews').length,0);
});

test('editing a mutable created_by or email metadata cannot grant candidate access',()=>{
 const copy=clone();
 copy.candidates.find(c=>c.id===testAccountId(3)).created_by=testAccountId(2);
 copy.profiles.find(p=>p.id===testAccountId(2)).role_request='admin';
 assert.equal(expectedReadableRows(copy,testAccountId(2),'candidates').length,1);
 assert(!expectedReadableRows(copy,testAccountId(2),'candidates')
   .some(c=>c.id===testAccountId(3)));
});

test('five historical writes and all direct mutations remain blocked by this read-only model',()=>{
 assert.deepEqual(FORBIDDEN_DIRECT_WRITES,['INSERT','UPDATE','DELETE','TRUNCATE','EXECUTE']);
 for(const operation of FORBIDDEN_DIRECT_WRITES)for(const t of READ_TABLES)
  assert.equal(mayDirectlyMutateAnyCRMTable(testAccountId(1),t,operation),false);
});

test('synthetic table and account graph is complete and uses only example.invalid emails',()=>{
 assert.equal(Object.keys(rows).length,19);
 assert.equal(mapping.users.length,9);
 assert(mapping.users.every(v=>v.email.endsWith('@example.invalid')));
 assert.equal(rows.profiles.length,8);
 assert.equal(rows.user_roles.length,8);
 assert.equal(rows.candidates.length,2);
 assert(!rows.profiles.some(p=>p.id===testAccountId(9)));
});
