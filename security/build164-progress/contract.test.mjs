import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluate,compareSnapshots} from "../release-progress/score.mjs";
import {render} from "../release-progress/workstream-report.mjs";
const read=x=>JSON.parse(readFileSync(new URL("../release-progress/"+x,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),current=read("current.json"),old=read("build138-evidence-baseline.json"),work=read("active-work-v1.json");
test("Build164 official 43-gate programme stays at accepted 26/100",()=>{
 assert.equal(rubric.milestones.length,43);
 assert.equal(evaluate(rubric,current).earned,26);
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.deepEqual(compareSnapshots(rubric,old,current),{previous:26,current:26,delta:0,newGates:[],regressed:[]});
});
test("Build164 real category breakdown is derived from fixed v1 rubric",()=>{
 assert.deepEqual(evaluate(rubric,current).groups.map(g=>[g.id,g.earned,g.weight,g.completed]),[
 ["KB",6,12,3],["LD",6,10,3],["MK",2,10,1],["SO",2,10,1],
 ["CRM",10,28,4],["BI",0,10,0],["REL",0,20,0]]);
});
test("Build164 audit package separates four source-evidenced and five pending milestones",()=>{
 assert.equal(work.steps.length,9);
 assert.equal(work.steps.filter(x=>x.status==="source_evidenced").length,4);
 assert.deepEqual(work.steps.filter(x=>x.status==="source_evidenced").map(x=>x.id),["AUD01","AUD02","AUD03","AUD04"]);
 assert.equal(current.statuses.find(s=>s.id==="CRM09").complete,false);
});
test("Build164 generated current report is byte-for-byte aligned with scorecard",()=>{
 const md=readFileSync(new URL("../release-progress/CURRENT-STATUS.md",import.meta.url),"utf8");
 assert.equal(md,render(rubric,current,work));
 assert(md.includes("26/100 (26%)"));
 assert(md.includes("4/9 source-preparation steps"));
 assert(md.includes("0/48 production security remediations"));
 assert(md.includes("0/140"));
 assert(md.includes("RELEASE HOLD"));
});
test("Build164 cannot falsely promote unfounded preparation to scored acceptance",()=>{
 const falseWork=JSON.parse(JSON.stringify(work));
 falseWork.steps[4].status="source_evidenced";
 assert.throws(()=>render(rubric,current,falseWork),/Source claim without evidence/);
 const bogus=JSON.parse(JSON.stringify(current));
 bogus.expected_earned_points=100;
 assert.throws(()=>render(rubric,bogus,work),/Official status drift/);
});
test("Build164 independent hosted, security, main and financial gates remain unaccepted",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10","REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
 assert.equal(current.statuses.find(s=>s.id===id)?.complete,false,id);
 assert.equal(current.observations.build164_reporting.new_milestones_closed,0);
 assert.equal(current.observations.build164_reporting.no_real_external_effects,true);
});
test("Build164 CI enforces report synchronization and historic scorecard checks",()=>{
 const ci=readFileSync(new URL("../../.github/workflows/build155-email-audit.yml",import.meta.url),"utf8");
 assert(ci.includes("node security/release-progress/workstream-report.mjs --check"));
 assert(ci.includes("security/build164-progress/contract.test.mjs"));
 assert(ci.includes("security/build138/scorecard-progression.test.mjs"));
 assert(ci.includes("security/build120/release-progress-contract.test.mjs"));
 assert(!ci.includes("workflow_dispatch:"));
});
