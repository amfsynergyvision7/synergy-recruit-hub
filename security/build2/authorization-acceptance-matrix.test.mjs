import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const matrix=JSON.parse(readFileSync(new URL('./authorization-acceptance-matrix.json',import.meta.url),'utf8'));
test('seven-role matrix is complete and every outcome is explicitly provisional',()=>{
 assert.equal(matrix.status,'DRAFT_ONLY_NOT_VERIFIED');
 assert.equal(matrix.release_gate_effect,'none');
 assert.deepEqual(matrix.roles,['anon','unapproved','recruiter_assigned','recruiter_other','admin','finance','integration']);
 const cases=new Set(matrix.tests.map(x=>x.case_id));
 assert.ok(cases.size>=20);
 assert.equal(matrix.tests.length,cases.size*matrix.roles.length);
 const ids=new Set();
 for(const row of matrix.tests){
  assert.equal(row.id,row.case_id+'__'+row.role);
  assert.ok(!ids.has(row.id),'duplicate '+row.id);ids.add(row.id);
  assert.ok(['allow','deny'].includes(row.expected));
  assert.equal(row.verified,false,'never claim execution without evidence');
  assert.ok(row.risk&&row.operation&&row.scope);
 }
 for(const name of cases){
  assert.deepEqual(matrix.tests.filter(x=>x.case_id===name).map(x=>x.role).sort(),[...matrix.roles].sort(),name);
 }
});
test('high-risk permissions fail closed for anonymous, unapproved, cross-recruiter and finance mutations',()=>{
 for(const row of matrix.tests){
  if(['anon','unapproved','integration'].includes(row.role))assert.equal(row.expected,'deny',row.id);
  if(row.case_id==='billing_mutate'||row.case_id==='workflow_financial_trigger'||row.case_id==='role_escalation')assert.equal(row.expected,'deny',row.id);
  if(row.case_id==='candidate_read_other'&&row.role==='recruiter_other')assert.equal(row.expected,'deny');
 }
});
