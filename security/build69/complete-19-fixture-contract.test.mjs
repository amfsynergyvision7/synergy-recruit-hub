import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=p=>JSON.parse(readFileSync(p,"utf8"));
const full=load("security/build69/complete-19-fixture-blueprint.json");
const base=load("security/build69/fixture-source-catalog.json");
const extra=load("security/build69/additional-seven-source-catalog.json");
const scope=load("security/build65/production-hosted-coverage.json");
const original=load("security/build69/synthetic-fixture-blueprint.json");

test("full source-pinned 19-table plan covers all historical and new table types",()=>{
 assert.equal(full.source_table_count,19);
 assert.equal(full.ordered_table_plans.length,19);
 assert.deepEqual(full.all_production_public_tables_exact,scope.production_public_tables);
 assert.deepEqual(full.all_expected_historical_source_tables_exact,scope.historical_matrix_tables);
 assert.deepEqual(new Set(full.ordered_table_plans.map(x=>x.table)),new Set(scope.production_public_tables));
 assert.equal(new Set(full.ordered_table_plans.map(x=>x.table)).size,19);
 assert.equal(base.source_tables.length,12);
 assert.equal(extra.table_count,7);
 assert.equal(extra.table_columns.length,7);
 assert.deepEqual(new Set([...base.source_tables,...extra.table_columns.map(x=>x.table_name)]),
  new Set(scope.production_public_tables));
});

test("all 32 source triggers and 26 foreign keys stay under review-only isolation",()=>{
 assert.equal(full.production_app_trigger_count,32);
 assert.equal(base.noninternal_trigger_count,29);
 assert.equal(extra.trigger_count,3);
 assert.equal(extra.noninternal_triggers.length,3);
 assert.equal(full.production_source_foreign_key_count,26);
 assert.equal(base.foreign_keys.length,26);
 assert.equal(extra.foreign_keys.length,0);
 // Trigger names are only unique within each table; workflow_rules_trigger
 // legitimately exists on several different production tables.
 const all=[...base.triggers,...extra.noninternal_triggers]
  .map(x=>x.table_name+"."+x.trigger_name);
 assert.equal(all.length,32);
 assert.equal(new Set(all).size,32);
 assert.ok(full.planned_all_suppressed_controls.some(x=>x.includes("all 32 application triggers")));
 assert.ok(full.planned_all_suppressed_controls.some(x=>x.includes("no billing")));
 assert.equal(full.approved_for_execution,false);
 assert.equal(full.synthetic_only,true);
 assert.equal(full.source_rows_copied,0);
 const idx=new Map(full.ordered_table_plans.map((x,i)=>[x.table,i]));
 for(const fk of base.foreign_keys){
  assert.ok(idx.get(fk.referenced_table)<idx.get(fk.table_name),fk.constraint_name);
 }
});

test("each of 19 table steps preserves exact live mandatory source fields and trigger inventory",()=>{
 for(const [i,step] of full.ordered_table_plans.entries()){
  assert.equal(step.sequence,i+1);
  const b=base.table_columns.find(x=>x.table_name===step.table);
  const e=extra.table_columns.find(x=>x.table_name===step.table);
  const expected=b?b.required_fields.map(x=>x.column):e?.required_no_default_columns;
  assert.ok(expected,"missing source fields "+step.table);
  assert.deepEqual(step.required_no_default_columns,expected);
  const expectedTriggers=[...base.triggers.filter(x=>x.table_name===step.table).map(x=>x.trigger_name),
   ...extra.noninternal_triggers.filter(x=>x.table_name===step.table).map(x=>x.trigger_name)];
  assert.deepEqual(step.app_trigger_names,expectedTriggers);
 }
 assert.deepEqual(full.ordered_table_plans.find(x=>x.table==="user_roles").required_no_default_columns,
  ["user_id","role"]);
 assert.deepEqual(full.ordered_table_plans.find(x=>x.table==="google_integrations").required_no_default_columns,
  ["user_id"]);
});

test("historical fixture requires exactly nine GoTrue subjects but eight profiles and eight role rows",()=>{
 assert.equal(full.invented_go_true_auth_users,9);
 assert.equal(full.synthetic_profile_rows,8);
 assert.equal(full.synthetic_user_role_rows,8);
 assert.equal(full.intentionally_unprofiled_and_unroled_auth_slot,9);
 assert.equal(full.candidate_recruiter_owner_rows,2);
 assert.equal(full.ordered_table_plans.find(x=>x.table==="profiles").minimum_illustrative_rows,8);
 assert.equal(full.ordered_table_plans.find(x=>x.table==="user_roles").minimum_illustrative_rows,8);
 assert.equal(full.ordered_table_plans.find(x=>x.table==="candidates").minimum_illustrative_rows,2);
 assert.equal(original.hosted_account_slots.length,9);
 assert.equal(original.hosted_account_slots[8].profile_record_required,false);
 assert.equal(original.hosted_account_slots[8].user_role_record_required,false);
 assert.equal(full.illustrative_minimum_total_table_rows,34);
 assert.equal(full.ordered_table_plans.reduce((s,x)=>s+x.minimum_illustrative_rows,0),34);
 assert.ok(full.gating_note.includes("not"));
});

test("integration/notification/financial side effects cannot be mistaken for a seed authorization",()=>{
 const c=full.planned_all_suppressed_controls.join("\n");
 for(const text of [
  "workflow_rules.is_active=false","email_log.status",
  "google_integrations.auto_sync_enabled=false","integrations.auto_sync=false",
  "sync_logs.status","all 32 application triggers",
  "no billing, offer lifecycle", "no real candidate"
 ])assert.ok(c.includes(text),text);
 assert.equal(extra.observed_defaults["google_integrations.auto_sync_enabled"],"false");
 assert.equal(extra.observed_defaults["integrations.auto_sync"],"false");
 assert.equal(extra.observed_defaults["sync_logs.status"],"'success'::text");
 assert.equal(extra.provisioning_allowed,false);
 const all=JSON.stringify(full);
 assert.doesNotMatch(all,/"(password|token|secret)"\s*:\s*"[^"]+"/i);
 assert.equal(full.formal_hosted_cases_accepted,0);
});
