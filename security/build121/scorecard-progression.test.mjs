import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const file=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=file("v1-rubric.json"),previous=file("build120-evidence-baseline.json"),current=file("current.json");
test("Build121 fixed rubric score reconciles 22 to 24 with solely LD03",()=>{
 const diff=compareSnapshots(rubric,previous,current);
 assert.deepEqual(diff,{previous:22,current:24,delta:2,newGates:["LD03"],regressed:[]});
 assert.equal(current.snapshot_build,121);
 assert.equal(evaluate(rubric,current).completed_milestones,11);
});
test("Build121 immutable Build120 baseline and all other milestone statuses unchanged",()=>{
 assert.equal(previous.expected_earned_points,22);assert.equal(previous.snapshot_build,120);
 const original=Object.fromEntries(previous.statuses.map(s=>[s.id,s.complete]));
 for(const status of current.statuses)if(status.id!=="LD03")assert.equal(status.complete,original[status.id],status.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});
test("Build121 LD03 cites CI and strictly synthetic, contact-free source discovery",()=>{
 const gate=current.statuses.find(x=>x.id==="LD03");
 assert(gate.complete&&gate.evidence.some(x=>x.includes("/actions/runs/43558920955")));
 assert(gate.evidence.some(x=>x.includes("lead-discovery/discover.mjs")));
 const o=current.observations.lead_discovery;
 assert.deepEqual([o.synthetic_sources,o.structured_business_entries,o.duplicates_merged,o.canonical_business_leads],[2,4,1,3]);
 assert.equal(o.real_source_discovery_approved,false);
 assert.equal(o.network_requests+o.crm_writes+o.outbound_messages,0);
});
test("Build121 release and hosted acceptance score stay zero",()=>{
 const stillOpen=["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10","REL01","REL02","REL03","REL04","REL05","REL06","REL07"];
 const map=Object.fromEntries(current.statuses.map(s=>[s.id,s.complete]));
 for(const id of stillOpen)assert.equal(map[id],false,id);
 assert.equal(current.observations.formal_acceptance.release_signoffs.signed,0);
 assert.equal(current.observations.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(current.observations.formal_acceptance.closed_workstreams.accepted,0);
});
