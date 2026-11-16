import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";

const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const prior=read("build126-evidence-baseline.json");
const current=read("build127-evidence-baseline.json");

test("Build127 fixed 43-gate scorecard remains at 26/100 until accepted evidence exists",()=>{
 assert.equal(prior.snapshot_build,126);
 assert.equal(current.snapshot_build,127);
 assert.equal(current.previous_file,"build126-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build127 preserves all previously accepted milestone states exactly",()=>{
 assert.equal(prior.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const previous=new Map(prior.statuses.map(x=>[x.id,x.complete]));
 for(const gate of current.statuses)assert.equal(gate.complete,previous.get(gate.id),gate.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});

test("Build127 import and board safety does not claim released imports or hosted authorization",()=>{
 const v=current.observations.import_and_board_hardening;
 assert.equal(v.stage,"DRAFT_OFFLINE_IMPORT_LIMITS_AND_BOARD_COMPLETENESS");
 assert.equal(v.file_size_limit_bytes,2097152);
 assert.equal(v.local_csv_excel_max_rows,500);
 assert.equal(v.local_max_columns,80);
 assert.equal(v.local_max_cell_chars,16384);
 assert.equal(v.malformed_csv_fails_closed,true);
 assert.equal(v.failed_or_stale_file_reads_discarded,true);
 assert.equal(v.unknown_candidate_stages_rejected,true);
 assert.equal(v.board_manual_refresh,true);
 assert.equal(v.board_unrestricted_realtime,false);
 assert.equal(v.candidate_stage_mutations_released,false);
 assert.equal(v.import_writes_released,false);
 assert.equal(v.lab_auth_users,0);
 assert.equal(v.lab_public_rls_policies,0);
 assert.equal(v.signed_hosted_uat_accepted,0);
 assert.equal(v.production_security_fixes_accepted,0);
 assert.equal(v.formal_release_signoffs,0);
 assert.equal(v.live_deployments_created_by_this_build,0);
});

test("Build127 release critical gates remain closed",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                    "REL01","REL02","REL03","REL04","REL05","REL06","REL07"]) {
  assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 }
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
});

test("Build127 cannot credit missing independent approvals",()=>{
 const fake=structuredClone(current);
 const milestone=fake.statuses.find(x=>x.id==="REL02");
 milestone.complete=true;milestone.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
