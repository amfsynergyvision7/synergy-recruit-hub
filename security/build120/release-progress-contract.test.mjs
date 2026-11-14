import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots, progressBar } from "../release-progress/score.mjs";
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
test("Build120 immutable retrospective Build119 baseline is exactly 22/100",()=>{
 const score=evaluate(rubric,baseline);
 assert.equal(score.earned,22);
 assert.equal(score.remaining,78);
 assert.equal(score.completed_milestones,10);
 assert.equal(score.closedWorkstreams,0);
 assert.deepEqual(score.groups.map(g=>g.earned),[6,2,2,2,10,0,0]);
 assert.equal(baseline.snapshot_build,119);
});
test("Build120 current score must reconcile to previous checked snapshot and exact gate IDs",()=>{
 const score=evaluate(rubric,current),prior=read(current.previous_file);
 const diff=compareSnapshots(rubric,prior,current);
 assert.equal(score.earned,current.expected_earned_points);
 assert.equal(diff.previous,current.previous_earned_points);
 assert.equal(diff.current,score.earned);
 assert.equal(diff.delta,current.delta_points);
 assert.deepEqual(diff.newGates,current.newly_closed_ids);
 assert.deepEqual(diff.regressed,current.regressed_ids);
});
test("Build120 future milestone progress can pass without changing the fixed v1 rubric",()=>{
 const next=structuredClone(current);
 next.statuses.find(s=>s.id==="BI01").complete=true;
 next.statuses.find(s=>s.id==="BI01").evidence=["https://example.invalid/independent-approval"];
 next.expected_earned_points=24;next.previous_earned_points=22;
 next.delta_points=2;next.newly_closed_ids=["BI01"];
 assert.equal(compareSnapshots(rubric,baseline,next).delta,2);
 next.delta_points=0;
 assert.throws(()=>compareSnapshots(rubric,baseline,next),/Unreconciled points delta/);
 next.delta_points=2;next.newly_closed_ids=[];
 assert.throws(()=>compareSnapshots(rubric,baseline,next),/Unreconciled milestone change IDs/);
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
test("Build120 baseline release gates have no fabricated approvals",()=>{
 const byId=Object.fromEntries(baseline.statuses.map(s=>[s.id,s]));
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10","REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(byId[id].complete,false,id);
 const o=baseline.observations;
 assert.equal(o.git.main_protected,false);
 assert.equal(o.lab.auth_users,0);assert.equal(o.lab.fixture_rows,0);
 assert.equal(o.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(o.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(o.formal_acceptance.release_signoffs.signed,0);
});
test("Build120 hosted or protected-merge claims require matching observed counters",()=>{
 for(const [gate,scoreDelta,pattern] of [
   ["CRM06",2,/GoTrue Auth/],["CRM07",2,/Hosted fixtures/],
   ["CRM08",4,/Signed hosted UAT/],["CRM09",4,/Production remediation/],
   ["REL01",3,/Protected main/],["REL02",3,/Independent protected/],
   ["REL06",3,/Nine signed/]
 ]) {
   const bad=structuredClone(current);
   bad.statuses.find(s=>s.id===gate).complete=true;
   bad.statuses.find(s=>s.id===gate).evidence=["https://example.invalid/check"];
   bad.expected_earned_points=current.expected_earned_points+scoreDelta;
   assert.throws(()=>evaluate(rubric,bad),pattern,gate);
 }
});
test("Build120 percent bars are deterministic and never imply launch authorization",()=>{
 assert.equal(progressBar(0,10),"░".repeat(10));
 assert.equal(progressBar(100,10),"█".repeat(10));
 assert.equal(progressBar(22,10),"██"+"░".repeat(8));
});
