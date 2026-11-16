import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";

const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json");
const before=read("build135-evidence-baseline.json");
const current=read("build136-evidence-baseline.json");

test("Build136 fixed 43-milestone accepted score remains exactly 26/100",()=>{
 assert.equal(before.snapshot_build,135);
 assert.equal(current.snapshot_build,136);
 assert.equal(current.previous_file,"build135-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,before,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build136 no milestone flipped without independently signed release evidence",()=>{
 assert.equal(before.statuses.length,43);
 assert.equal(current.statuses.length,43);
 const originals=new Map(before.statuses.map(s=>[s.id,s.complete]));
 for(const item of current.statuses)assert.equal(item.complete,originals.get(item.id),item.id);
 assert.deepEqual(current.newly_closed_ids,[]);
 assert.equal(current.delta_points,0);
});

test("Build136 admin duplicate-review redaction is not treated as signed RLS acceptance",()=>{
 const x=current.observations.build136_duplicate_review;
 assert.equal(x.error_diagnostics_removed_from_browser,true);
 assert.equal(x.approved_admin_entry_gate_preserved,true);
 assert.equal(x.unique_admin_server_gate_preserved,true);
 assert.equal(x.no_candidate_delete_or_stage_write,true);
 assert.equal(x.signed_hosted_rls_not_accepted,true);
});

test("Build136 historical vs nonprod catalog discrepancy is quantified without production inference",()=>{
 const x=current.observations.build136_isolated_lab_catalog;
 assert.equal(x.public_tables,19);
 assert.equal(x.tables_rls_enabled,19);
 assert.equal(x.tables_rls_forced,19);
 assert.equal(x.public_views,13);
 assert.equal(x.public_views_security_invoker,13);
 assert.equal(x.public_security_definer_functions,7);
 assert.equal(x.historic_production_review_catalog_security_definer_functions,16);
 assert.equal(x.lab_privileged_function_name_discrepancy_count,9);
 assert.equal(x.lab_missing_relative_to_historic_catalog.length,9);
 assert.equal(x.lab_absence_is_not_production_absence,true);
 assert.equal(x.lab_or_production_database_mutations_executed,0);
});

test("Build136 no verified Auth users, role policies or functional API grants in lab",()=>{
 const x=current.observations.build136_isolated_lab_catalog;
 assert.equal(x.public_rls_policies,0);
 assert.equal(x.auth_users,0);
 assert.equal(x.public_enabled_application_triggers,0);
 assert.equal(x.anon_and_authenticated_table_view_select_grants,0);
 assert.equal(x.anon_and_authenticated_security_definer_execute_grants,0);
 assert.equal(x.exact_public_table_rows,0);
 assert.equal(x.signed_hosted_uat_acceptances,0);
 assert.equal(x.independently_accepted_production_security_remediations,0);
});

test("Build136 independent review and protected merge controls remain unresolved",()=>{
 const x=current.observations.build136_release_gate_dependencies;
 assert.equal(x.protected_main,false);
 assert.equal(x.ruleset_count,0);
 assert.equal(x.independent_pr12_reviews,0);
 assert.equal(x.independent_pr15_reviews,0);
 assert.equal(x.auth_fixture_verified,0);
 assert.equal(x.inert_rows_verified,0);
 assert.equal(x.signed_hosted_uat_verified,0);
 assert.equal(x.production_security_objects_accepted,0);
 assert.equal(x.release_signoffs_verified,0);
 assert.equal(x.new_independently_accepted_milestones,0);
});

test("Build136 previous final-head engineering CI correctly recorded",()=>{
 const x=current.observations.build136_release_gate_dependencies;
 assert.equal(x.build135_exact_head_fast_tests_passed,848);
 assert.equal(x.build135_exact_head_guarded_substantive_jobs_passed,36);
 assert.equal(x.build135_exact_head_intentional_release_hold_failed,1);
 assert.equal(x.build136_final_ci_status,"PENDING_AT_PREPARATION");
});

test("Build136 48-object production and nine release-gate milestones cannot self-close",()=>{
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10",
                   "REL01","REL02","REL03","REL04","REL05","REL06","REL07"])
   assert.equal(current.statuses.find(s=>s.id===id)?.complete,false,id);
 const fake=structuredClone(current);
 const gate=fake.statuses.find(s=>s.id==="REL01");
 gate.complete=true;gate.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
