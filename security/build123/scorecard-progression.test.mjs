import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),prior=read("build122-evidence-baseline.json"),now=read("build123-evidence-baseline.json");

test("Build123 43-gate deployment score honestly remains 26/100 with zero new milestones",()=>{
 assert.deepEqual(compareSnapshots(rubric,prior,now),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(now.snapshot_build,123);
 assert.equal(now.previous_file,"build122-evidence-baseline.json");
 assert.equal(evaluate(rubric,now).remaining,74);
 assert.equal(evaluate(rubric,now).completed_milestones,12);
});
test("Build123 every individual fixed gate remains identical to Build122 evidence",()=>{
 const prev=Object.fromEntries(prior.statuses.map(s=>[s.id,s.complete]));
 for(const state of now.statuses)assert.equal(state.complete,prev[state.id],state.id);
 assert.equal(now.statuses.length,43);
 assert.equal(evaluate(rubric,now).closedWorkstreams,0);
});
test("Build123 audited browser remediations are not called independently accepted BI or RLS gates",()=>{
 const x=now.observations.reporting_security;
 assert.equal(x.stage,"DRAFT_UI_DEFENSE_IN_DEPTH");
 assert.equal(x.candidate_reporting_rbac_tested,true);
 assert.equal(x.financial_analytics_release_hold,true);
 assert.equal(x.audit_admin_only,true);
 assert.equal(x.csv_formula_neutralization_tested,true);
 assert.equal(x.actual_signed_rls_uat_cases,0);
 assert.equal(x.independent_bi_approval,false);
 assert.equal(x.production_database_changes,0);
 assert.equal(x.real_financial_flows_activated,false);
 const map=new Map(now.statuses.map(s=>[s.id,s.complete]));
 for(const id of ["BI01","BI02","BI03","BI04","BI05","CRM08","CRM09","REL01","REL02","REL06","REL07"])
   assert.equal(map.get(id),false,id);
});
test("Build123 new reporting security evidence cannot be confused with 140 signed hosted tests",()=>{
 const x=now.observations;
 assert.equal(x.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(x.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(x.formal_acceptance.release_signoffs.signed,0);
 assert.equal(x.formal_acceptance.closed_workstreams.accepted,0);
 assert.equal(x.lab.auth_users,0);
 assert.equal(x.lab.fixture_rows,0);
 assert.equal(x.git.main_protected,false);
 assert.equal(x.git.pr15_merged,false);
});
test("Build123 first-party score test forbids inventing BI02 acceptance via code evidence alone",()=>{
 const spoof=structuredClone(now);
 spoof.statuses.find(x=>x.id==="BI02").complete=true;
 spoof.statuses.find(x=>x.id==="BI02").evidence=[];
 assert.throws(()=>evaluate(rubric,spoof),/lacks evidence/);
});
