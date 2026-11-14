import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const prior=read("build134-evidence-baseline.json");
const current=read("current.json");

test("Build135 fixed programme acceptance remains exactly 26/100 and 12/43",()=>{
 assert.equal(prior.snapshot_build,134);
 assert.equal(current.snapshot_build,135);
 assert.equal(current.previous_file,"build134-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build135 no independent milestone is silently added or removed",()=>{
 assert.equal(prior.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const prev=new Map(prior.statuses.map(x=>[x.id,x.complete]));
 for(const x of current.statuses)assert.equal(x.complete,prev.get(x.id),x.id);
 assert.deepEqual(current.newly_closed_ids,[]);
 assert.equal(current.delta_points,0);
});
test("Build135 Build134 guarded failure is acknowledged not misrepresented as 36/37",()=>{
 const x=current.observations.build135_guarded_recovery;
 assert.equal(x.prior_build134_guarded_total,37);
 assert.equal(x.prior_build134_guarded_successful,33);
 assert.deepEqual(x.prior_build134_guarded_unexpected_failures,[
   "build60-pr-reconciliation-and-recovery",
   "audited-account-and-profile-transaction-review",
 ]);
 assert.equal(x.prior_build134_guarded_dependent_summary_failure,true);
 assert.equal(x.prior_build134_intentional_production_release_hold_failure,true);
 assert.equal(x.two_outdated_contracts_updated_to_stronger_safety,true);
});
test("Build135 owner-specific notifications stay complete without signed server RLS acceptance",()=>{
 const x=current.observations.build135_notifications;
 assert.equal(x.old_hard_limit_100_removed,true);
 assert.equal(x.count_reconciled_id_pages_250_max_2500,true);
 assert.equal(x.malformed_and_nullable_owner_or_read_status_rejected_before_type_narrowing,true);
 assert.equal(x.cross_user_row_fails_entire_page_not_silently_filtered,true);
 assert.equal(x.mark_read_receipt_owner_and_id_verified,true);
 assert.equal(x.hosted_signed_notification_rls_acceptance,false);
});
test("Build135 organization and account mutations remain held pending independent policies",()=>{
 const x=current.observations.build135_account_and_branding_holds;
 assert.equal(x.user_administration_mutations_held,true);
 assert.equal(x.self_profile_mutations_hard_held,true);
 assert.equal(x.organization_branding_and_settings_mutations_hard_held,true);
 assert.equal(x.branding_storage_upload_and_delete_blocked_before_rpc_or_storage,true);
 assert.equal(x.global_default_theme_update_blocked,true);
 assert.equal(x.local_theme_selection_preserved,true);
 assert.equal(x.server_rpc_and_storage_grants_independently_accepted,false);
 assert.equal(x.production_or_staging_mutations_executed,0);
});
test("Build135 read-only hosted lab remains empty and cannot prove role permissions",()=>{
 const x=current.observations.build135_lab_readonly;
 assert.equal(x.health,"ACTIVE_HEALTHY");
 assert.equal(x.public_tables,19);
 assert.equal(x.public_tables_rls_enabled,19);
 assert.equal(x.public_rls_policies,0);
 assert.equal(x.hosted_auth_users,0);
 assert.equal(x.exact_counted_public_tables,19);
 assert.equal(x.exact_rows,0);
 assert.equal(x.database_writes,0);
});
test("Build135 release and hosted permission acceptance milestones remain open",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
  "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
  assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_independent_reviews,0);
 assert.equal(current.observations.git.pr15_independent_reviews,0);
});
test("Build135 cannot fabricate an independent production release signoff",()=>{
 const forged=structuredClone(current);
 const gate=forged.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,forged),/Completed gate lacks evidence/);
});
