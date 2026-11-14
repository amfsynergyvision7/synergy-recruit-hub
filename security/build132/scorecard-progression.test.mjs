import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const baseline=read("build131-evidence-baseline.json");
const current=read("build132-evidence-baseline.json");

test("Build132 fixed acceptance ledger still 26/100, no invented milestone closure",()=>{
 assert.equal(baseline.snapshot_build,131);
 assert.equal(current.snapshot_build,132);
 assert.equal(current.previous_file,"build131-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,baseline,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build132 all original 43 gate statuses remain immutable without independent evidence",()=>{
 assert.equal(current.statuses.length,43);
 const before=new Map(baseline.statuses.map(s=>[s.id,s.complete]));
 for(const gate of current.statuses)assert.equal(gate.complete,before.get(gate.id),gate.id);
});
test("Build132 prior guarded outcome must NOT be misreported as 36/37 success",()=>{
 const x=current.observations.build132_repaired_guards;
 assert.equal(x.build131_final_fast_tests_passed,654);
 assert.equal(x.build131_final_guarded_jobs_total,37);
 assert.equal(x.build131_final_guarded_jobs_successful,33);
 assert.deepEqual(x.build131_final_guarded_unexpected_failures,[
  "application-compile","build50-browser-write-safety"
 ]);
 assert.equal(x.build131_final_guarded_summary_failed_due_to_substantive_failures,true);
 assert.equal(x.build131_intentional_production_release_hold_failed,true);
 assert.equal(x.production_release_enabled,false);
});
test("Build132 page decoder and mutation checks remain browser-only defenses",()=>{
 const x=current.observations.build132_repaired_guards;
 assert.equal(x.raw_sql_or_credential_access_used,false);
 assert.equal(x.runtime_checked_page_identifier_shape,true);
 assert.equal(x.mixed_dynamic_supabase_result_awaited,true);
 assert.equal(x.all_four_crud_callbacks_verify_approved_data_and_permission,true);
 assert.equal(x.candidate_and_billing_holds_unconditionally_preserved,true);
 assert.equal(x.fast_workflow_runs_npm_build_then_tsc,true);
 assert.equal(x.fast_independent_candidate_finance_contracts_added,true);
});
test("Build132 hosted nonproduction lab remains empty, pending independent signoff",()=>{
 const x=current.observations.build132_lab_readonly;
 assert.equal(x.health,"ACTIVE_HEALTHY");
 assert.equal(x.public_tables,19);
 assert.equal(x.public_tables_rls_enabled,19);
 assert.equal(x.public_policies,0);
 assert.equal(x.auth_users,0);
 assert.equal(x.enabled_public_application_triggers,0);
 assert.equal(x.observed_table_rows_reported,0);
 assert.equal(x.verified_readonly,true);
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_independent_reviews,0);
 assert.equal(current.observations.git.pr15_independent_reviews,0);
});
test("Build132 all release and hosted acceptance milestones remain open",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                   "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
});
test("Build132 fabricated release acceptance is still rejected by evidence constraints",()=>{
 const fake=structuredClone(current);
 const v=fake.statuses.find(s=>s.id==="REL01");
 v.complete=true;v.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
