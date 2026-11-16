import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateHistorical135,READ_TABLES} from './role-read-oracle.mjs';

const report=JSON.parse(readFileSync(new URL('135-case-role-coverage-review.json',import.meta.url),'utf8'));
const matrix=JSON.parse(readFileSync(new URL('../build41/signed-http-135-read-matrix.json',import.meta.url),'utf8'));

test('independent review grid contains exactly nine source roles by 15 historical tables',()=>{
 assert.equal(report.read_case_count,135);
 assert.equal(report.role_slots,9);
 assert.equal(report.tables.length,15);
 assert.deepEqual(report.tables,READ_TABLES);
 assert.equal(report.slots.length,9);
 assert.equal(matrix.read_cases.length,135);
 for(let i=0;i<9;i++){
  assert.equal(report.slots[i].slot,i+1);
  const cases=matrix.read_cases.slice(i*15,(i+1)*15);
  for(const c of cases)
    assert.equal(report.slots[i].expected_read_counts[c.table],c.expected,c.case_id);
 }
});

test('all source role status combinations align with historical admin, recruiter, finance and negatives',()=>{
 const r=report.slots;
 assert.equal(r[0].role,'admin');
 assert.equal(r[0].allowed_table_count,15);
 assert.equal(r[0].visible_row_count_sum,34);
 for(const slot of [1,2]){
  assert.equal(r[slot].role,'recruiter');
  assert.equal(r[slot].visible_row_count_sum,7);
 }
 assert.equal(r[3].role,'finance');
 assert.equal(r[3].visible_row_count_sum,3);
 for(const slot of [4,5,6,7])assert.equal(r[slot].visible_row_count_sum,2);
 assert.equal(r[8].role,null);
 assert.equal(r[8].visible_row_count_sum,0);
 assert.equal(r[8].has_profile,false);
});

test('zero actual session, hosted execution, accepted UAT and production write claims',()=>{
 assert.equal(report.signed_go_true_sessions_run,0);
 assert.equal(report.hosted_read_cases_executed,0);
 assert.equal(report.formal_uat_cases_accepted,0);
 assert.equal(report.production_policies_changed,0);
 assert.equal(report.write_cases_executed,0);
 assert.match(report.interpretation,/not real PostgreSQL or signed HTTP/);
 assert.equal(evaluateHistorical135().pure_model_pass,135);
});

test('report contains no user UUIDs, real email addresses, token or confidential row content',()=>{
 const text=JSON.stringify(report);
 assert.doesNotMatch(text,/@[a-z0-9.-]+\.[a-z]+/i);
 assert.doesNotMatch(text,/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/i);
 assert.doesNotMatch(text,/service_role_key|jwt_secret|access_token|refresh_token/i);
});
