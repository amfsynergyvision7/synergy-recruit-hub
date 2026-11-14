import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";

const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const prior=read("build130-evidence-baseline.json");
const current=read("current.json");

test("Build131 score remains 26/100 with 12/43 milestones evidenced",()=>{
 assert.equal(prior.snapshot_build,130);
 assert.equal(current.snapshot_build,131);
 assert.equal(current.previous_file,"build130-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build131 43 gate flags and weights remain unchanged",()=>{
 assert.equal(prior.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const old=new Map(prior.statuses.map(x=>[x.id,x.complete]));
 for(const x of current.statuses)assert.equal(x.complete,old.get(x.id),x.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});

test("Build131 count-complete browser improvements are not accepted server RLS",()=>{
 const x=current.observations.build131_paged_browser_crm;
 assert.equal(x.stage,"DRAFT_BOUNDED_CLIENT_READS_PENDING_SIGNED_SERVER_RLS");
 assert.equal(x.crm_page_size,250);
 assert.equal(x.crm_max_rows,2500);
 assert.equal(x.main_list_count_reconciled,true);
 assert.equal(x.relation_lists_count_reconciled,true);
 assert.equal(x.candidate_board_count_reconciled,true);
 assert.equal(x.edits_deletions_exports_withheld_until_source_and_relation_verified,true);
 assert.equal(x.candidate_stage_write_hold_retained,true);
 assert.equal(x.finance_mutation_holds_retained,true);
 assert.equal(x.shared_crud_wildcard_projection_remains_unapproved,true);
 assert.equal(x.hosted_role_rls_accepted,false);
 assert.equal(x.production_mutations_or_db_writes_executed,0);
 assert.equal(x.branch_merged,false);
});

test("Build131 independent review, protected main and signed release remain zero",()=>{
 const x=current.observations.build131_evidence;
 assert.equal(x.independent_pr12_reviews,0);
 assert.equal(x.independent_pr15_reviews,0);
 assert.equal(x.protected_main,false);
 assert.equal(x.hosted_signed_uat_accepted,0);
 assert.equal(x.production_security_remediations_accepted,0);
 assert.equal(x.release_signoffs,0);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
});

test("Build131 read-only lab audit retains empty 19-table state",()=>{
 const x=current.observations.build131_lab_readonly;
 assert.equal(x.project_status,"ACTIVE_HEALTHY");
 assert.equal(x.public_tables,19);
 assert.equal(x.public_rls_enabled,19);
 assert.equal(x.public_rls_policies,0);
 assert.equal(x.auth_users,0);
 assert.equal(x.fixture_rows_reported,0);
 assert.equal(x.fixture_rows_exact_count,0);
 assert.equal(x.exact_counted_tables,19);
 assert.equal(x.row_validation_method,"read_only_select_count_per_each_public_table");
 assert.equal(x.public_enabled_application_triggers,0);
 assert.equal(x.mutations_executed,0);
});

test("Build131 release and hosted acceptance milestones remain open",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
  "BI01","BI02","BI03","BI04","BI05",
  "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
});

test("Build131 cannot self-accept a release milestone with no evidence",()=>{
 const forged=structuredClone(current);
 const gate=forged.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,forged),/Completed gate lacks evidence/);
});
