import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const catalog=JSON.parse(readFileSync("security/build65/production-hosted-coverage.json","utf8"));
const matrix=JSON.parse(readFileSync("security/build41/signed-http-135-read-matrix.json","utf8"));
const harness=readFileSync("security/build64/hosted-135-readonly.mjs","utf8");

test("historical hosted matrix is not a current 19-table and 13-view release acceptance",()=>{
 const historical=[...new Set(matrix.read_cases.map(c=>c.table))];
 const uncovered=catalog.production_public_tables.filter(x=>!historical.includes(x));
 assert.equal(catalog.production_public_tables.length,19);
 assert.equal(new Set(catalog.production_public_tables).size,19);
 assert.equal(catalog.production_public_views.length,13);
 assert.equal(new Set(catalog.production_public_views).size,13);
 assert.equal(historical.length,15);
 assert.equal(matrix.read_cases.length,135);
 assert.deepEqual(historical,catalog.historical_matrix_tables);
 assert.deepEqual(uncovered,["app_settings","candidate_stage_history","email_log","workflow_rules"]);
 assert.deepEqual(uncovered,catalog.uncovered_production_tables);
 assert.deepEqual(catalog.uncovered_production_views,catalog.production_public_views);
 assert.equal(catalog.historical_write_cases_deferred,5);
 assert.equal(catalog.hosted_read_case_acceptance,0);
 assert.equal(catalog.current_release_all_scope_acceptance,false);
 assert.match(harness,/write_cases_executed:0,write_cases_deferred:5/);
 assert.match(harness,/formally_accepted_cases:0/);
});
test("historical matrix subject fingerprints, expected counts and nine fixture roles must remain pinned",()=>{
 assert.match(harness,/FROZEN_READ_COUNTS/);
 assert.match(harness,/FROZEN_SUBJECTS/);
 assert.match(harness,/FIXTURE_PROFILES/);
 assert.match(harness,/fixture_integrity_checks:18/);
 assert.match(harness,/redirect:"error"/);
});
