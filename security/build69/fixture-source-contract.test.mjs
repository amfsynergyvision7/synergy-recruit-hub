import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const raw=(file)=>JSON.parse(readFileSync(file,"utf8"));
const source=raw("security/build69/fixture-source-catalog.json");
const plan=raw("security/build69/synthetic-fixture-blueprint.json");
const views=raw("security/build68/view-fixture-dependencies.json");
const historical=raw("security/build41/signed-http-135-read-matrix.json");

test("twelve synthetic source types exactly match read-only catalog and view dependencies",()=>{
 assert.equal(source.source_table_count,12);
 assert.equal(source.table_columns.length,12);
 assert.deepEqual(source.source_tables,views.fixture_source_tables_to_consider);
 assert.equal(plan.ordered_table_plans.length,12);
 assert.deepEqual(new Set(plan.ordered_table_plans.map(x=>x.table)),new Set(source.source_tables));
 assert.equal(new Set(source.source_tables).size,12);
 assert.equal(plan.provisioning_allowed,undefined);
 assert.equal(plan.authorizes_nonproduction_writes,false);
 assert.equal(plan.executable_sql_included,false);
 assert.equal(plan.deliberately_nonexecutable,true);
 assert.equal(plan.historical_140_case_coverage,"NOT_COMPLETED");
 assert.equal(plan.formal_accepted_cases,0);
});

test("actual 26 production FKs are topologically satisfiable by the proposed source order",()=>{
 assert.equal(source.foreign_key_count,26);
 assert.equal(source.foreign_keys.length,26);
 const order=new Map(plan.ordered_table_plans.map((step,i)=>[step.table,i]));
 assert.equal(new Set(order.keys()).size,12);
 for(const fk of source.foreign_keys){
  assert.ok(order.has(fk.table_name),fk.table_name);
  assert.ok(order.has(fk.referenced_table),fk.referenced_table);
  assert.ok(order.get(fk.referenced_table)<order.get(fk.table_name),
    "FK source after dependent: "+fk.constraint_name);
 }
 for(const table of plan.ordered_table_plans){
  assert.deepEqual(table.direct_references,
   [...new Set(source.foreign_keys.filter(x=>x.table_name===table.table).map(x=>x.referenced_table))].sort());
  assert.equal(table.sequence,order.get(table.table)+1);
 }
});

test("all 29 production app triggers remain review-blocked; workflow/finance risk explicitly flagged",()=>{
 assert.equal(source.noninternal_trigger_count,29);
 assert.equal(source.triggers.length,29);
 const risky=source.triggers.filter(x=>x.seed_gate==="BLOCK_UNTIL_SIDE_EFFECT_ISOLATION_REVIEW");
 assert.equal(risky.length,10);
 assert.deepEqual(new Set(source.high_risk_trigger_functions),new Set([
  "run_workflow_rules","on_candidate_stage_change","on_offer_change",
  "on_interview_change","on_submission_insert"
 ]));
 assert.ok(risky.every(t=>source.high_risk_trigger_functions.includes(t.function_name)));
 assert.ok(source.triggers.every(t=>["BLOCK_UNTIL_SIDE_EFFECT_ISOLATION_REVIEW",
  "REVIEW_BEFORE_ANY_INSERT"].includes(t.seed_gate)));
 for(const step of plan.ordered_table_plans){
  assert.deepEqual(step.app_trigger_names,
   source.triggers.filter(x=>x.table_name===step.table).map(x=>x.trigger_name));
  assert.deepEqual(step.high_risk_triggers,
   source.triggers.filter(x=>x.table_name===step.table&&x.seed_gate.startsWith("BLOCK")).map(x=>x.trigger_name));
 }
 assert.equal(source.provisioning_allowed,false);
 assert.equal(source.nonproduction_seed_performed,false);
 assert.equal(plan.requires_independent_trigger_safety_review,true);
 assert.ok(plan.explicit_holds.some(s=>s.includes("No invoice numbers")));
});

test("required non-default fields are exact from source catalog for every intended invented fixture",()=>{
 for(const step of plan.ordered_table_plans){
  const req=source.table_columns.find(x=>x.table_name===step.table)?.required_fields.map(x=>x.column);
  assert.ok(req,"expected fields missing "+step.table);
  assert.deepEqual(step.required_no_default_columns,req);
 }
 assert.deepEqual(plan.ordered_table_plans.find(x=>x.table==="workflow_rules").required_no_default_columns,
 ["name","table_name","field_name","field_value","action_type"]);
 assert.deepEqual(plan.ordered_table_plans.find(x=>x.table==="email_log").required_no_default_columns,
 ["related_table","related_id","to_email","subject","body"]);
 assert.deepEqual(plan.ordered_table_plans.find(x=>x.table==="candidate_stage_history").required_no_default_columns,["new_stage"]);
});

test("fixture has nine external GoTrue accounts, exactly eight profiles/roles and one negative unprofiled identity",()=>{
 assert.equal(plan.minimum_planned_go_true_accounts,9);
 assert.equal(plan.hosted_account_slots.length,9);
 assert.equal(plan.minimum_planned_profiles,8);
 assert.equal(plan.hosted_account_slots.filter(x=>x.profile_record_required).length,8);
 assert.equal(plan.hosted_account_slots.filter(x=>x.user_role_record_required).length,8);
 assert.equal(plan.hosted_account_slots[8].expected_role,null);
 assert.equal(plan.hosted_account_slots[8].profile_status,null);
 assert.equal(plan.hosted_account_slots[8].profile_active,null);
 assert.equal(plan.ordered_table_plans.find(x=>x.table==="profiles").minimum_illustrative_rows,8);
 assert.equal(plan.ordered_table_plans.find(x=>x.table==="candidates").minimum_illustrative_rows,2);
 assert.equal(plan.proposed_minimum_fixture_rows_across_twelve_tables,20);
 assert.equal(historical.read_cases.length,135);
 for(const [i,s] of plan.hosted_account_slots.entries()){
  assert.equal(s.slot,i+1);
  assert.equal(s.go_true_account_required,true);
  assert.match(s.expected_uuid_env,/^AMF_UAT_CASE_0[1-9]_EXPECTED_UUID$/);
  assert.equal(s.credential_source,"APPROVED_EXTERNAL_SECRETS_ONLY");
 }
 const expected=[
  ["admin","approved",true],["recruiter","approved",true],["recruiter","approved",true],
  ["finance","approved",true],["operations","approved",true],["recruiter","pending",true],
  ["recruiter","approved",false],["viewer","approved",true],[null,null,null]
 ];
 assert.deepEqual(plan.hosted_account_slots.map(s=>[s.expected_role,s.profile_status,s.profile_active]),expected);
});

test("known unsafe live defaults must be overridden; no real addresses or executable fixture SQL",()=>{
 assert.match(plan.known_live_defaults_requiring_override["public.workflow_rules.is_active"],/true.*false/);
 assert.match(plan.known_live_defaults_requiring_override["public.email_log.status"],/sent.*never-sent/);
 assert.match(plan.ordered_table_plans.find(x=>x.table==="workflow_rules").requirements,/is_active=false/);
 assert.match(plan.ordered_table_plans.find(x=>x.table==="email_log").requirements,/never use default 'sent'/);
 const serialized=JSON.stringify(plan);
 assert.match(serialized,/example\.invalid/);
 assert.doesNotMatch(serialized,/"password"\s*:\s*"[^"]+"/i);
 assert.doesNotMatch(serialized,/"access_token"\s*:/);
 assert.equal(plan.authorizes_nonproduction_writes,false);
});
