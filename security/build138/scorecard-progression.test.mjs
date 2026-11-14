import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluate,compareSnapshots} from "../release-progress/score.mjs";
const read=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const before=read("build137-evidence-baseline.json");
const current=read("current.json");

test("Build138 score is unchanged at 26/100, 12 accepted, 31 still open",()=>{
 assert.equal(before.snapshot_build,137);
 assert.equal(current.snapshot_build,138);
 assert.equal(current.previous_file,"build137-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,before,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build138 browser safety cannot certify a production release milestone",()=>{
 assert.equal(current.statuses.length,43);
 const previous=new Map(before.statuses.map(x=>[x.id,x.complete]));
 for(const x of current.statuses)assert.equal(x.complete,previous.get(x.id),x.id);
 assert.deepEqual(current.newly_closed_ids,[]);
 assert.equal(current.delta_points,0);
});
test("Build138 Sheets browser configuration and sync are strictly paused",()=>{
 const s=current.observations.build138_integration_release;
 assert.equal(s.browser_configuration_mutations_hard_held,true);
 assert.equal(s.browser_candidate_sync_mutations_hard_held,true);
 assert.equal(s.browser_sheet_url_header_and_mapping_inputs_disabled,true);
 assert.equal(s.browser_save_detect_sync_handlers_refuse_before_server_calls,true);
 assert.equal(s.server_external_effect_holds_preserved,true);
 assert.equal(s.admin_identity_exact_subject_gate_preserved,true);
 assert.equal(s.signed_hosted_integrations_acceptance,false);
});
test("Build138 privileged log read minimizes data and does not mislead on errors",()=>{
 const s=current.observations.build138_integration_release;
 assert.equal(s.sync_log_privileged_database_projection_reduced,true);
 assert.equal(s.historical_sheet_url_redacted_in_diagnostics,true);
 assert.equal(s.sync_history_raw_provider_row_error_messages_withheld,true);
 assert.equal(s.sync_history_failure_not_presented_as_zero_runs,true);
 assert.equal(s.sync_history_maximum_preview_rows,50);
});
test("Build138 actual nonprod lab read-only check does not assert role UAT",()=>{
 const s=current.observations.build138_nonprod_readonly;
 assert.equal(s.health,"ACTIVE_HEALTHY");
 assert.equal(s.public_tables,19);
 assert.equal(s.rls_tables,19);
 assert.equal(s.public_rls_policies,0);
 assert.equal(s.hosted_auth_users,0);
 assert.equal(s.enabled_public_app_triggers,0);
 assert.equal(s.exact_counted_public_tables,19);
 assert.equal(s.exact_public_rows,0);
 assert.equal(s.database_writes,0);
});
test("Build138 previous final guarded is accurately distinguished from current final pending",()=>{
 const s=current.observations.build138_release_state;
 assert.equal(s.build137_exact_head_fast_offline_passed,896);
 assert.equal(s.build137_fast_independent_safety_passed,11);
 assert.equal(s.build137_exact_head_guarded_substantive_jobs_passed,36);
 assert.equal(s.build137_intentional_production_hold_failed,1);
 assert.equal(s.intermediate_build138_fast_offline_passed,909);
 assert.equal(s.intermediate_build138_independent_safety_passed,11);
 assert.equal(s.intermediate_build138_app_build_typecheck_passed,true);
 assert.equal(s.final_build138_fast_verified,false);
 assert.equal(s.final_build138_guarded_verified,false);
});
test("Build138 independent review and protected environment remain unaccepted",()=>{
 const s=current.observations.build138_release_state;
 assert.equal(s.main_protected,false);
 assert.equal(s.repo_rulesets,0);
 assert.equal(s.independent_pr12_reviews,0);
 assert.equal(s.independent_pr15_reviews,0);
 assert.equal(s.protected_environment_configuration_verified,false);
 assert.equal(s.hosted_signed_uat_accepted,0);
 assert.equal(s.production_security_remediations_accepted,0);
 assert.equal(s.release_signoffs_accepted,0);
 assert.equal(s.new_independently_accepted_milestones,0);
});
test("Build138 release and functional pending gates cannot be marked approved",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
 "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
  assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 const fake=structuredClone(current);
 const gate=fake.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
