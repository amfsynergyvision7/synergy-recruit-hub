import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),prior=read("build123-evidence-baseline.json"),current=read("current.json");
test("Build124 fixed score remains 26/100 with exactly zero new or regressed gates",()=>{
 const change=compareSnapshots(rubric,prior,current);
 assert.deepEqual(change,{previous:26,current:26,delta:0,newGates:[],regressed:[]});
 assert.equal(current.snapshot_build,124);
 assert.equal(current.previous_file,"build123-evidence-baseline.json");
 assert.equal(evaluate(rubric,current).remaining,74);
 assert.equal(evaluate(rubric,current).completed_milestones,12);
});
test("Build124 no accepted milestone changes from the exact immutable Build123 snapshot",()=>{
 assert.equal(prior.snapshot_build,123);
 const priorStates=new Map(prior.statuses.map(s=>[s.id,s.complete]));
 for(const state of current.statuses)assert.equal(state.complete,priorStates.get(state.id),state.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});
test("Build124 only credits draft pagination and dashboard integrity, no server acceptance",()=>{
 const x=current.observations.reporting_completeness;
 assert.equal(x.stage,"DRAFT_NO_ACCEPTED_BI_BACKEND");
 assert.equal(x.page_size,250);
 assert.equal(x.max_rows_per_source,2500);
 assert.equal(x.truncated_pages_rejected,true);
 assert.equal(x.drfting_count_rejected??x.drifting_count_rejected,true);
 assert.equal(x.duplicate_id_rejected,true);
 assert.equal(x.abort_on_account_or_refresh_switch,true);
 assert.equal(x.real_cross_transaction_snapshot,false);
 assert.equal(x.independent_bi_data_contract_accepted,false);
 assert.equal(x.hosted_signed_bi_uat,0);
 assert.equal(x.production_database_writes,0);
 assert.equal(x.financial_reporting_enabled,false);
});
test("Build124 does not silently close BI01–05 or any PR/security hosted release gates",()=>{
 const ids=Object.fromEntries(current.statuses.map(s=>[s.id,s.complete]));
 for(const id of ["BI01","BI02","BI03","BI04","BI05","CRM05","CRM06","CRM07","CRM08","CRM09","REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
  assert.equal(ids[id],false,id);
 assert.equal(current.observations.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(current.observations.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(current.observations.formal_acceptance.release_signoffs.signed,0);
 assert.equal(current.observations.formal_acceptance.closed_workstreams.accepted,0);
});
test("Build124 rejects fabricated BI acceptance without independent evidence",()=>{
 const overclaim=structuredClone(current);
 const claimed=overclaim.statuses.find(s=>s.id==="BI03");
 claimed.complete=true;claimed.evidence=[];
 assert.throws(()=>evaluate(rubric,overclaim),/Completed gate lacks evidence/);
});
