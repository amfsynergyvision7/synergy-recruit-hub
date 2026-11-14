import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, progressBar } from "../release-progress/score.mjs";
const read=(path)=>JSON.parse(readFileSync(new URL("../release-progress/"+path,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),current=read("current.json"),baseline=read("build119-retrospective-baseline.json");
const fixed = "KB01:2,KB02:2,KB03:2,KB04:2,KB05:2,KB06:2,LD01:2,LD02:2,LD03:2,LD04:2,LD05:2,MK01:2,MK02:2,MK03:2,MK04:2,MK05:2,SO01:2,SO02:2,SO03:2,SO04:2,SO05:2,CRM01:3,CRM02:3,CRM03:2,CRM04:2,CRM05:3,CRM06:2,CRM07:2,CRM08:4,CRM09:4,CRM10:3,BI01:2,BI02:2,BI03:2,BI04:2,BI05:2,REL01:3,REL02:3,REL03:2,REL04:3,REL05:3,REL06:3,REL07:3";
test("Build120 fixed rubric has exactly 43 non-duplicated milestones and 100 points",()=>{
 assert.equal(rubric.milestones.map(m=>m.id+":"+m.weight).join(","),fixed);
 assert.equal(rubric.milestones.length,43);
 assert.equal(rubric.groups.length,7);
 assert.deepEqual(rubric.groups.map(g=>g.weight),[12,10,10,10,28,10,20]);
 assert.equal(rubric.change_policy.includes("Never alter"),true);
});
test("Build120 current 22/100 is computed from binary evidence, never an arbitrary percentage",()=>{
 const result=evaluate(rubric,current);
 assert.equal(result.earned,22);
 assert.equal(result.remaining,78);
 assert.equal(result.completed_milestones,10);
 assert.equal(result.milestones_total,43);
 assert.equal(result.closedWorkstreams,0);
 assert.deepEqual(result.groups.map(g=>g.earned),[6,2,2,2,10,0,0]);
});
test("Build120 retrospective Build119 baseline applies identical rubric and honest zero delta",()=>{
 assert.equal(evaluate(rubric,baseline).earned,22);
 assert.equal(current.prior_comparable_baseline_points,22);
 assert.equal(current.snapshot_build,120);
 assert.equal(baseline.snapshot_build,119);
 assert.deepEqual(current.statuses,baseline.statuses);
});
test("Build120 falsely completed gate without evidence must be rejected",()=>{
 const changed=structuredClone(current);
 const gate=changed.statuses.find(x=>x.id==="REL01");
 gate.complete=true;
 gate.evidence=[];
 assert.throws(()=>evaluate(rubric,changed),/lacks evidence/);
});
test("Build120 missing gates, duplicates, or score inflation fail closed",()=>{
 const missing=structuredClone(current);
 missing.statuses.pop();
 assert.throws(()=>evaluate(rubric,missing),/Missing state/);
 const dup=structuredClone(current);
 dup.statuses.push({...dup.statuses[0]});
 assert.throws(()=>evaluate(rubric,dup),/Duplicate snapshot gate/);
 const inflated=structuredClone(current);
 inflated.expected_earned_points=72;
 assert.throws(()=>evaluate(rubric,inflated),/Score does not match evidence states/);
});
test("Build120 all protected merge, hosted UAT, finance and launch gates remain open",()=>{
 const byId=Object.fromEntries(current.statuses.map(s=>[s.id,s]));
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10","REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(byId[id].complete,false,id);
 const o=current.observations;
 assert.equal(o.git.main_protected,false);
 assert.equal(o.git.ruleset_count,0);
 assert.equal(o.git.pr15_merged,false);
 assert.equal(o.lab.auth_users,0);
 assert.equal(o.lab.fixture_rows,0);
 assert.equal(o.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(o.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(o.formal_acceptance.release_signoffs.signed,0);
 assert.equal(o.formal_acceptance.closed_workstreams.accepted,0);
});
test("Build120 percent bars are deterministic and never imply launch authorization",()=>{
 assert.equal(progressBar(0,10),"░".repeat(10));
 assert.equal(progressBar(100,10),"█".repeat(10));
 assert.equal(progressBar(22,10),"██"+"░".repeat(8));
});
