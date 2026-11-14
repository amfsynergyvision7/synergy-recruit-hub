import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const load=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=load("v1-rubric.json"),previous=load("build121-evidence-baseline.json"),current=load("current.json");
test("Build122 fixed 43-gate rubric changes only LD04 from 24/100 to 26/100",()=>{
 const change=compareSnapshots(rubric,previous,current);
 assert.deepEqual(change,{previous:24,current:26,delta:2,newGates:["LD04"],regressed:[]});
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build122 preserves exact Build121 status and all other 42 acceptance decisions",()=>{
 assert.equal(previous.snapshot_build,121);
 assert.equal(previous.expected_earned_points,24);
 const p=Object.fromEntries(previous.statuses.map(x=>[x.id,x.complete]));
 for(const st of current.statuses)
   if(st.id!=="LD04")assert.equal(st.complete,p[st.id],st.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});
test("Build122 lead review credited only with synthetic evidence and audited, no-send handoff",()=>{
 const gate=current.statuses.find(x=>x.id==="LD04"),o=current.observations.lead_review;
 assert(gate.complete&&gate.evidence.some(x=>x.includes("/actions/runs/43561219866")));
 assert(gate.evidence.some(x=>x.includes("/security/lead-discovery/review.mjs")));
 assert.equal(o.fictional_company_records,3);
 assert.equal(o.offline_handoff_count,1);
 assert.equal(o.actual_human_reviews,0);
 assert.equal(o.actual_crm_handoffs,0);
 assert.equal(o.crm_writes+o.network_requests+o.outbound_messages,0);
 assert.equal(o.audited_events_are_cryptographic_signatures,false);
 assert.equal(o.separate_growth_and_crm_reviewers_required,true);
});
test("Build122 score calculation rejects unsupported simulated LD04 completion",()=>{
 const falseClaim=structuredClone(current);
 falseClaim.observations.lead_review.audit_verified=false;
 assert.throws(()=>evaluate(rubric,falseClaim),/LD04 synthetic no-send/);
 const sendClaim=structuredClone(current);
 sendClaim.observations.lead_review.crm_writes=1;
 assert.throws(()=>evaluate(rubric,sendClaim),/LD04 synthetic no-send/);
 const missingHandoff=structuredClone(current);
 missingHandoff.observations.lead_review.offline_handoff_count=0;
 assert.throws(()=>evaluate(rubric,missingHandoff),/LD04 synthetic no-send/);
});
test("Build122 programme and production gates still have zero independent signoffs",()=>{
 const o=current.observations,ids=new Map(current.statuses.map(x=>[x.id,x.complete]));
 for(const id of ["LD02","LD05","SO04","CRM05","CRM06","CRM07","CRM08","CRM09","REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(ids.get(id),false,id);
 assert.equal(o.git.main_protected,false);
 assert.equal(o.git.pr15_merged,false);
 assert.equal(o.lab.auth_users,0);
 assert.equal(o.lab.fixture_rows,0);
 assert.equal(o.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(o.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(o.formal_acceptance.release_signoffs.signed,0);
 assert.equal(o.formal_acceptance.closed_workstreams.accepted,0);
});
