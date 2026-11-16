import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const load=n=>JSON.parse(readFileSync(new URL("../release-progress/"+n,import.meta.url),"utf8"));
const rubric=load("v1-rubric.json"),prior=load("build124-evidence-baseline.json"),current=load("build125-evidence-baseline.json");
test("Build125 immutable full score stays 26/100 with no invented milestone closures",()=>{
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(current.snapshot_build,125);
 assert.equal(current.previous_file,"build124-evidence-baseline.json");
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build125 retains exact 43 gate states and prior signed/unsigned evidence",()=>{
 assert.equal(prior.snapshot_build,124);
 assert.equal(prior.statuses.length,43);
 const prev=Object.fromEntries(prior.statuses.map(x=>[x.id,x.complete]));
 for(const row of current.statuses) assert.equal(row.complete,prev[row.id],row.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});
test("Build125 new security controls are draft without accepted independent RLS",()=>{
 const x=current.observations.private_route_security;
 assert.equal(x.stage,"DRAFT_BROWSER_AND_RESPONSE_PRIVACY_ONLY");
 assert.equal(x.unrestricted_user_directory_reads,0);
 assert.equal(x.unrestricted_timeline_subscriptions,0);
 assert.equal(x.candidate_timeline_personal_fields_selected,false);
 assert.equal(x.revoked_profile_access_rejected,true);
 assert.equal(x.deep_match_raw_resume_returned_to_browser,false);
 assert.equal(x.ai_browser_provider_activation,false);
 assert.equal(x.actual_signed_hosted_uat,0);
 assert.equal(x.independent_role_rls_accepted,false);
 assert.equal(x.production_writes+x.external_messages_sent,0);
});
test("Build125 BI and CRM production authorization remain open despite browser fixes",()=>{
 const map=Object.fromEntries(current.statuses.map(x=>[x.id,x.complete]));
 for(const id of ["BI01","BI02","BI03","BI04","BI05","CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                  "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
  assert.equal(map[id],false,id);
 const o=current.observations;
 assert.equal(o.git.main_protected,false);
 assert.equal(o.git.pr15_merged,false);
 assert.equal(o.lab.auth_users,0);
 assert.equal(o.lab.fixture_rows,0);
 assert.equal(o.formal_acceptance.hosted_signed_uat.accepted,0);
 assert.equal(o.formal_acceptance.production_security_remediations.accepted,0);
 assert.equal(o.formal_acceptance.release_signoffs.signed,0);
});
test("Build125 fabricated accepted RLS gate with no signed evidence is rejected",()=>{
 const fake=structuredClone(current);
 const candidate=fake.statuses.find(x=>x.id==="BI02");
 candidate.complete=true;candidate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
