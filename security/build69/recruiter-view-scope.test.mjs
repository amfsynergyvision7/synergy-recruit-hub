import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const audit=JSON.parse(readFileSync("security/build69/recruiter-view-scope-audit.json","utf8"));
const fixture=JSON.parse(readFileSync("security/build69/synthetic-fixture-blueprint.json","utf8"));
const views=JSON.parse(readFileSync("security/build68/view-fixture-dependencies.json","utf8"));

const wanted=[
 "available_recruiters","recruiter_performance","recruiter_performance_with_names",
 "recruiter_stats","recruiter_summary"
];
test("five source-fingerprinted recruiter views need a separate active-role business review",()=>{
 assert.equal(audit.source_view_count,5);
 assert.deepEqual(audit.views.map(x=>x.view_name),wanted);
 assert.ok(audit.views.every(x=>/^[0-9a-f]{32}$/.test(x.definition_md5)));
 assert.ok(audit.views.every(x=>x.approved_status_predicate===true));
 assert.ok(audit.views.every(x=>x.active_flag_predicate===false));
 assert.ok(audit.views.every(x=>x.role_scope_predicate===false));
 assert.equal(audit.views.filter(x=>x.left_join_candidate).length,4);
 assert.ok(audit.views.every(x=>views.views[x.view_name]));
 assert.equal(audit.production_changed,false);
 assert.equal(audit.formal_release_acceptance,0);
});

test("historical synthetic role slots show legacy approved-only scope can overinclude nonrecruiters",()=>{
 const slots=fixture.hosted_account_slots.filter(x=>x.profile_record_required);
 const sourceScope=slots.filter(x=>x.profile_status==="approved");
 const proposedScope=sourceScope.filter(x=>x.profile_active&&x.expected_role==="recruiter");
 assert.deepEqual(sourceScope.map(x=>x.slot),[1,2,3,4,5,7,8]);
 assert.deepEqual(proposedScope.map(x=>x.slot),[2,3]);
 assert.ok(sourceScope.some(x=>x.expected_role==="admin"));
 assert.ok(sourceScope.some(x=>x.expected_role==="finance"));
 assert.ok(sourceScope.some(x=>x.expected_role==="viewer"));
 assert.ok(sourceScope.some(x=>x.profile_active===false));
 assert.ok(audit.consequences_to_test.length>=4);
});

test("do not silently change the fingerprint-guarded Build59 view release candidate",()=>{
 const source=readFileSync("security/build59/13-view-write-acl-review-only.sql","utf8");
 assert.match(source,/a90d4a1fab9552d47697127888e10d19/);
 const proposal=readFileSync("security/build69/recruiter-view-scope-review.md","utf8");
 assert.match(proposal,/REVIEW ONLY/i);
 assert.match(proposal,/do not execute/i);
 assert.match(proposal,/security_invoker=true/i);
 assert.match(proposal,/is_active\s*=\s*true/i);
 assert.match(proposal,/user_roles/i);
 assert.match(proposal,/recruiter/i);
 assert.match(proposal,/Build59/i);
});
