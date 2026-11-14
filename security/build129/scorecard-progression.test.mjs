import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const previous=read("build128-evidence-baseline.json");
const current=read("build129-evidence-baseline.json");

test("Build129 score: prior 26/100, current 26/100, and zero new gates",()=>{
 assert.equal(previous.snapshot_build,128);
 assert.equal(current.snapshot_build,129);
 assert.equal(current.previous_file,"build128-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,previous,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build129 preserves the identity and 43 completion flags from prior snapshot",()=>{
 assert.equal(current.statuses.length,43);
 const before=new Map(previous.statuses.map(row=>[row.id,row.complete]));
 for(const row of current.statuses)assert.equal(row.complete,before.get(row.id),row.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});

test("Build129 browser gates do not pretend to authorize hosted RLS or sync",()=>{
 const x=current.observations.build129_private_routes;
 assert.equal(x.stage,"DRAFT_BROWSER_ONLY_NOT_ACCEPTED_HOSTED_RLS");
 assert.equal(x.integration_reads_admin_gated,true);
 assert.equal(x.integration_cache_keyed_by_verified_user,true);
 assert.equal(x.integration_server_admin_assertions_retained,true);
 assert.equal(x.integration_external_sync_hold_retained,true);
 assert.equal(x.settings_route_approved_account_gated,true);
 assert.equal(x.notifications_exact_count_required,true);
 assert.equal(x.notifications_unexpected_owner_rejected,true);
 assert.equal(x.no_production_or_staging_writes,true);
 assert.equal(x.no_finance_activation,true);
 assert.equal(x.accepted_new_programme_gates,0);
});

test("Build129 independence and hosted gates are still open",()=>{
 const x=current.observations.build129_evidence;
 assert.equal(x.protected_main,false);
 assert.equal(x.independent_pr12_reviews,0);
 assert.equal(x.independent_pr15_reviews,0);
 assert.equal(x.hosted_signed_uat_cases_accepted,0);
 assert.equal(x.production_fixes_accepted,0);
 assert.equal(x.release_signoffs,0);
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
});

test("Build129 all release and hosted security gates remain formally unaccepted",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                   "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
 assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
});

test("Build129 cannot claim formal acceptance without evidence",()=>{
 const fake=structuredClone(current);
 const gate=fake.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
