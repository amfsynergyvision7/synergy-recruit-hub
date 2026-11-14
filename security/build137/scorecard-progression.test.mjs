import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluate,compareSnapshots} from "../release-progress/score.mjs";
const get=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=get("v1-rubric.json");
const previous=get("build136-evidence-baseline.json");
const current=get("current.json");

test("Build137 evidence weighted rubric remains 26/100 with 12 of 43 accepted",()=>{
 assert.equal(previous.snapshot_build,136);
 assert.equal(current.snapshot_build,137);
 assert.equal(current.previous_file,"build136-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,previous,current),{
 previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build137 no unsigned gate can flip merely from offline tests",()=>{
 assert.equal(current.statuses.length,43);
 const old=new Map(previous.statuses.map(x=>[x.id,x.complete]));
 for(const s of current.statuses)assert.equal(s.complete,old.get(s.id),s.id);
 assert.deepEqual(current.newly_closed_ids,[]);
 assert.equal(current.delta_points,0);
});
test("Build137 search preview source integrity is not a signed hosted role test",()=>{
 const x=current.observations.build137_source;
 assert.equal(x.global_search_checked_all_three_buckets_before_display,true);
 assert.equal(x.global_search_malformed_rows_and_duplicate_ids_rejected,true);
 assert.equal(x.global_search_six_per_module_not_completeness_claim,true);
 assert.equal(x.global_search_account_keyed_shell_and_query_abort_preserved,true);
 assert.equal(x.global_search_privacy_role_http_acceptance,false);
 assert.equal(x.peer_review_or_main_merge_performed,false);
});
test("Build137 read-only lab remains nonfunctional for real signed Auth UAT",()=>{
 const x=current.observations.build137_nonprod_auth;
 assert.equal(x.lab_public_tables,19);
 assert.equal(x.lab_forced_rls_tables,19);
 assert.equal(x.lab_public_views,13);
 assert.equal(x.lab_security_invoker_views,13);
 assert.equal(x.lab_privileged_functions,7);
 assert.equal(x.historical_privileged_function_reference,16);
 assert.equal(x.missing_from_lab_vs_historical_reference,9);
 assert.equal(x.role_approval_helpers_missing_from_lab.length,4);
 assert.equal(x.lab_public_policies,0);
 assert.equal(x.lab_auth_users,0);
 assert.equal(x.lab_table_rows,0);
 assert.equal(x.lab_data_and_schema_writes_performed,0);
 assert.equal(x.real_signed_uat_accepted,0);
 assert.equal(x.historical_reference_not_current_prod_source,true);
});
test("Build137 independent PR15 release and protected environment remain blocked",()=>{
 const x=current.observations.build137_release_gate;
 assert.equal(x.main_protected,false);
 assert.equal(x.main_rulesets,0);
 assert.equal(x.independent_pr12_reviews,0);
 assert.equal(x.independent_pr15_reviews,0);
 assert.equal(x.auth_pr15_open_unmerged,true);
 assert.equal(x.auth_pr15_ci_passed,true);
 assert.equal(x.protected_environment_configuration_verified,false);
 assert.equal(x.auth_users_created,0);
 assert.equal(x.fictional_rows_created,0);
 assert.equal(x.signed_hosted_uat_accepted,0);
 assert.equal(x.accepted_production_security_remediations,0);
 assert.equal(x.signed_release_approvals,0);
});
test("Build137 no finance, customer or release gate was independently accepted",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
 "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
 assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 const fake=structuredClone(current);
 const gate=fake.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
