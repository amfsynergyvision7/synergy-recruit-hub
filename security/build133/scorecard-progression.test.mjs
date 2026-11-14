import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const before=read("build132-evidence-baseline.json");
const current=read("current.json");

test("Build133 acceptance preserves exactly 26/100 across frozen 43-gate ledger",()=>{
 assert.equal(before.snapshot_build,132);
 assert.equal(current.snapshot_build,133);
 assert.equal(current.previous_file,"build132-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,before,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});
test("Build133 no formal milestone flips without independently accepted evidence",()=>{
 assert.equal(current.statuses.length,43);
 const prior=new Map(before.statuses.map(x=>[x.id,x.complete]));
 for(const s of current.statuses)assert.equal(s.complete,prior.get(s.id),s.id);
});
test("Build133 workflow-rule browser changes are draft safety, not hosted trigger retirement",()=>{
 const x=current.observations.build133_workflow_rules;
 assert.equal(x.old_unverified_role_ui_mount_removed,true);
 assert.equal(x.exact_approved_admin_gate_before_private_workspace,true);
 assert.equal(x.account_and_role_scoped_workspace,true);
 assert.equal(x.no_browser_rule_create_update_delete_or_active_toggle,true);
 assert.equal(x.unconditional_workflow_browser_mutation_hold,true);
 assert.equal(x.existing_hosted_triggers_or_rules_disabled,false);
 assert.equal(x.hosted_rls_and_trigger_effects_accepted,false);
});
test("Build133 least-data browser projection does not self-certify RLS column grants",()=>{
 const x=current.observations.build133_crm_projection;
 assert.equal(x.shared_crm_select_star_removed,true);
 assert.equal(x.reviewed_module_table_pairing_enforced,true);
 assert.equal(x.relation_select_star_fallback_removed,true);
 assert.equal(x.virtual_ui_fields_excluded,true);
 assert.equal(x.server_column_grants_accepted,false);
});
test("Build133 activity timeline source completeness still requires signed server RLS",()=>{
 const x=current.observations.build133_activity_timeline;
 assert.equal(x.exact_count_page_250_max_2500,true);
 assert.equal(x.incomplete_or_unverified_history_not_shown_as_zero,true);
 assert.equal(x.authorizing_server_rls_accepted,false);
});
test("Build133 isolated lab is empty and READ ONLY, not a configured Auth acceptance lab",()=>{
 const x=current.observations.build133_lab_readonly;
 assert.equal(x.project_status,"ACTIVE_HEALTHY");
 assert.equal(x.public_tables,19);
 assert.equal(x.rls_enabled_tables,19);
 assert.equal(x.public_policies,0);
 assert.equal(x.actual_auth_users,0);
 assert.equal(x.enabled_public_app_triggers,0);
 assert.equal(x.exact_counted_public_tables,19);
 assert.equal(x.exact_total_fixture_rows,0);
 assert.equal(x.production_or_staging_database_writes,0);
 assert.equal(x.authorized_fictional_hosted_uat_started,false);
});
test("Build133 protects actual release gates from source-only self-approval",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                   "BI01","BI02","BI03","BI04","BI05",
                   "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
  assert.equal(current.statuses.find(x=>x.id===id)?.complete,false,id);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
 assert.equal(current.observations.git.main_protected,false);
});
test("Build133 forged release signoff is not accepted by score evaluation",()=>{
 const fake=structuredClone(current);
 const gate=fake.statuses.find(x=>x.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
