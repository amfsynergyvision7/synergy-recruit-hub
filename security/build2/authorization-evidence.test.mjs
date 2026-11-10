import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileAuthorization} from './authorization-evidence.mjs';
const matrix=JSON.parse(readFileSync(new URL('./authorization-acceptance-matrix.json',import.meta.url),'utf8'));
const sample=()=>({fixture_type:'synthetic',environment:'disposable',source_scope:'approved_schema_equivalent',schema_fingerprint:'sha256:'+'a'.repeat(64),executed_at:'2026-11-10T00:00:00Z',reviewer:'synthetic-reviewer',results:matrix.tests.map(x=>({id:x.id,actual:x.expected,evidence_ref:'synthetic-log/'+x.id}))});
test('complete synthetic evidence reconciles without approving a release',()=>{
 const r=reconcileAuthorization(matrix,sample());
 assert.equal(r.pass,true);assert.equal(r.expected_count,140);assert.equal(r.recorded_count,140);
});
test('missing one of 140 results fails closed',()=>{
 const x=sample();x.results.pop();
 assert.equal(reconcileAuthorization(matrix,x).findings.filter(f=>f.type==='missing_result').length,1);
});
test('cross-recruiter unauthorized access fails',()=>{
 const x=sample();const row=x.results.find(r=>r.id==='candidate_read_other__recruiter_other');row.actual='allow';
 assert.ok(reconcileAuthorization(matrix,x).findings.some(f=>f.type==='authorization_mismatch'&&f.id===row.id));
});
test('missing environment provenance and evidence references fail',()=>{
 const x=sample();x.source_scope='unknown';x.schema_fingerprint='';x.reviewer='';x.results[0].evidence_ref='';
 const types=reconcileAuthorization(matrix,x).findings.map(f=>f.type);
 for(const type of ['unverified_environment','missing_schema_fingerprint','missing_reviewer','missing_evidence_ref'])assert.ok(types.includes(type),type);
});
test('duplicate, unexpected, and invalid outcomes fail',()=>{
 const x=sample();x.results.push({...x.results[0]},{id:'invented',actual:'allow',evidence_ref:'synthetic-log/extra'});x.results[1].actual='unknown';
 const types=reconcileAuthorization(matrix,x).findings.map(f=>f.type);
 for(const type of ['duplicate_result','unexpected_result','invalid_outcome'])assert.ok(types.includes(type),type);
});
