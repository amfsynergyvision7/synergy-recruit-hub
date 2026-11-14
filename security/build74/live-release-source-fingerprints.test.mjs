import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const src=JSON.parse(read("security/build74/live-release-source-fingerprints.json"));

test("live source digest reconciliation covers exactly policy, view and legacy function source fingerprints",()=>{
 assert.equal(src.evidence_type,"LIVE_READ_ONLY_RELEASE_SOURCE_FINGERPRINT_RECONCILIATION");
 assert.equal(src.project_ref,"wusntntcqgtpgokggdzv");
 assert.equal(src.matched_source_checks,3);
 assert.deepEqual(src.checks.map(x=>[x.scope,x.count]),[
  ["existing_public_rls_policies",67],["all_thirteen_public_views",13],
  ["four_legacy_function_definitions",4]
 ]);
 assert.ok(src.checks.every(x=>x.match&&x.observed_md5===x.expected_md5));
 assert.ok(src.checks.every(x=>/^[a-f0-9]{32}$/.test(x.observed_md5)));
 assert.equal(src.checks[2].unset_search_path_count,4);
 assert.equal(src.checks[2].security_definer_count,2);
});
test("all three actual observed digests are unchanged source guards in release-candidate input",()=>{
 const expected=[
  "a70190f31ed8436b2989082898a02b51",
  "a90d4a1fab9552d47697127888e10d19",
  "ea5005b2208a2d0891e3f8004fd7de80"
 ];
 assert.deepEqual(src.checks.map(x=>x.observed_md5),expected);
 for(const [i,c] of src.checks.entries()){
  assert.ok(read(c.source).includes(expected[i]),"protected source digest not present "+c.source);
 }
 assert.equal(src.actual_business_rows_queried,0);
 assert.equal(src.live_database_writes,0);
 assert.match(src.caveat,/not approval/);
});
test("new 22-function post-release check never replaces current production 16-function check",()=>{
 const old=read("security/build73/48-object-release-preflight.readonly.sql");
 const newer=read("security/build74/compose-postrelease-permission-check.mjs");
 assert.match(old,/actual_privileged_functions=16/);
 assert.doesNotMatch(old,/actual_privileged_functions=22/);
 assert.match(newer,/actual_privileged_functions=22/);
 assert.match(newer,/reviewedRpcs|approvedRpcs/);
 assert.match(newer,/combinedFixture=/);
});
