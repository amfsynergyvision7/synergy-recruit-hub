import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const prior=read("build133-evidence-baseline.json");
const current=read("current.json");

test("Build134 fixed 43-gate acceptance remains 26/100 despite source progress",()=>{
 assert.equal(prior.snapshot_build,133);
 assert.equal(current.snapshot_build,134);
 assert.equal(current.previous_file,"build133-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build134 no independent approval status was changed by browser source",()=>{
 assert.equal(prior.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const statuses=new Map(prior.statuses.map(x=>[x.id,x.complete]));
 for(const x of current.statuses)assert.equal(x.complete,statuses.get(x.id),x.id);
});
test("Build134 audit timeline correctness cannot self-certify signed server permissions",()=>{
 const x=current.observations.build134_audit_integrity;
 assert.equal(x.old_silent_limit_200_removed,true);
 assert.equal(x.complete_metadata_id_paging_250_max_2500,true);
 assert.equal(x.payload_and_email_columns_excluded,true);
 assert.equal(x.failed_read_visible_not_falsely_empty,true);
 assert.equal(x.direct_server_rls_and_column_grants_independently_accepted,false);
});
test("Build134 administrator directory remains zero-mutation and independently held",()=>{
 const x=current.observations.build134_private_user_directory;
 assert.equal(x.profiles_and_roles_both_count_reconciled,true);
 assert.equal(x.duplicate_or_orphan_membership_rejected,true);
 assert.equal(x.browser_user_management_hard_disabled,true);
 assert.equal(x.frontend_build_environment_cannot_enable_role_changes,true);
 assert.equal(x.production_user_role_mutations,0);
 assert.equal(x.authorized_hosted_admin_rpc_review_passed,false);
});
test("Build134 recruiter preview remains narrow, abortable and mutation-held",()=>{
 const x=current.observations.build134_recruiter_selector;
 assert.equal(x.old_silent_limit_150_removed,true);
 assert.equal(x.verified_recruiter_role_id_paging_250_max_2500,true);
 assert.equal(x.approved_active_profile_choices_batched_to_100_per_query,true);
 assert.equal(x.editing_and_csv_held_without_complete_assignee_verification,true);
 assert.equal(x.unchanged_candidate_write_hold,true);
 assert.equal(x.server_rls_acceptance_signed,false);
});
test("Build134 hosted lab RLS present does not mean authorized role testing passed",()=>{
 const x=current.observations.build134_nonprod_readonly;
 assert.equal(x.health,"ACTIVE_HEALTHY");
 assert.equal(x.public_tables_exactly_counted,19);
 assert.equal(x.public_tables_rls_enabled,19);
 assert.equal(x.public_rls_policies,0);
 assert.equal(x.hosted_auth_users,0);
 assert.equal(x.enabled_public_triggers,0);
 assert.equal(x.verified_total_rows,0);
 assert.equal(x.database_writes_performed,0);
 assert.equal(x.authenticated_signed_uat_case_acceptances,0);
});
test("Build134 protected main, independent reviews and UAT remain open",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
 "BI01","BI02","BI03","BI04","BI05","REL01","REL02","REL03","REL04",
 "REL05","REL06","REL07"])
  assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_independent_reviews,0);
 assert.equal(current.observations.git.pr15_independent_reviews,0);
 assert.equal(current.observations.build134_ci_evidence.new_formally_accepted_milestones,0);
});
test("Build134 cannot mark release acceptance complete without signed evidence",()=>{
 const forged=structuredClone(current);
 const gate=forged.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,forged),/Completed gate lacks evidence/);
});
