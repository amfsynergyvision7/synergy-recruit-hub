import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),previous=read("build129-evidence-baseline.json"),current=read("build130-evidence-baseline.json");

test("Build130 43-gate acceptance score remains strictly 26/100",()=>{
 assert.equal(previous.snapshot_build,129);
 assert.equal(current.snapshot_build,130);
 assert.equal(current.previous_file,"build129-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,previous,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build130 cannot rewrite acceptance states or programme weights",()=>{
 assert.equal(previous.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const states=new Map(previous.statuses.map(row=>[row.id,row.complete]));
 for(const x of current.statuses)assert.equal(x.complete,states.get(x.id),x.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});

test("Build130 report correctness changes are not accepted BI RLS or UAT gates",()=>{
 const x=current.observations.build130_reports;
 assert.equal(x.stage,"DRAFT_BI_SOURCE_CORRECTNESS_NOT_SIGNED_HOSTED_UAT");
 assert.equal(x.related_candidate_client_links_checked,true);
 assert.equal(x.unassigned_recruiter_counts_included,true);
 assert.equal(x.invalid_date_windows_block_metrics_and_exports,true);
 assert.equal(x.finance_analytics_still_held,true);
 assert.equal(x.hosted_data_validation_accepted,false);
 assert.equal(x.signed_real_rls_matrix_cases,0);
});

test("Build130 live lab read-only evidence must not be claimed as synthetic provisioning",()=>{
 const x=current.observations.build130_lab_readonly;
 assert.equal(x.public_tables_exactly_counted,19);
 assert.equal(x.public_tables_rls_enabled,19);
 assert.equal(x.public_table_rows_exact_counts,0);
 assert.equal(x.auth_users_exact_count,0);
 assert.equal(x.public_rls_policies_exact_count,0);
 assert.equal(x.enabled_public_application_triggers,0);
 assert.equal(x.performed_only_readonly_sql,true);
 assert.equal(x.lab_go_true_and_fixture_provisioning_done,false);
 assert.equal(x.accepted_hosted_uat_cases,0);
});

test("Build130 production and merge controls remain independently held",()=>{
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
 const required=["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
 "REL01","REL02","REL03","REL04","REL05","REL06","REL07"];
 for(const id of required)assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
});

test("Build130 fabricated gate completion still fails without signed evidence",()=>{
 const fake=structuredClone(current);
 const gate=fake.statuses.find(x=>x.id==="REL01");
 gate.complete=true; gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
