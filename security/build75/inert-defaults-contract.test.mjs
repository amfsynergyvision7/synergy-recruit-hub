import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=x=>JSON.parse(readFileSync(x,"utf8"));
const defaults=load("security/build75/live-inert-defaults.json");
const plan=load("security/build69/complete-19-fixture-blueprint.json");
test("all seven current live defaults and known outbound/finance risks stay documented",()=>{
 assert.equal(defaults.evidence_type,"LIVE_READONLY_SEVEN_SIDE_EFFECT_RELEVANT_DEFAULTS");
 assert.equal(defaults.items.length,7);
 assert.equal(defaults.production_mutations,0);
 assert.equal(defaults.hosted_fixture_rows_written,0);
 const asMap=Object.fromEntries(defaults.items.map(x=>[x.table_name+"."+x.column_name,x.default_expr]));
 assert.deepEqual(Object.keys(asMap).sort(),[
  "billing.payment_status","email_log.status","google_integrations.auto_sync_enabled",
  "integrations.auto_sync","offers.offer_status","sync_logs.status","workflow_rules.is_active"
 ].sort());
 assert.equal(asMap["workflow_rules.is_active"],"true");
 assert.equal(asMap["email_log.status"],"'sent'::text");
 assert.equal(asMap["sync_logs.status"],"'success'::text");
 assert.equal(asMap["google_integrations.auto_sync_enabled"],"false");
 assert.equal(asMap["integrations.auto_sync"],"false");
 assert.equal(asMap["billing.payment_status"],"'unpaid'::text");
 assert.equal(asMap["offers.offer_status"],"'pending'::text");
 assert.deepEqual(new Set(defaults.unsafe_default_cases.map(x=>x.table_name+"."+x.column_name)),
  new Set(["workflow_rules.is_active","email_log.status","sync_logs.status"]));
});
test("the pre-existing synthetic fixture blueprint already forbids triggering those defaults",()=>{
 const text=plan.planned_all_suppressed_controls.join("\n");
 assert.match(text,/workflow_rules\.is_active=false explicitly/);
 assert.match(text,/email_log\.status must be explicit non-sent synthetic state/);
 assert.match(text,/sync_logs\.status must be explicit synthetic never-run state/);
 assert.match(text,/google_integrations\.auto_sync_enabled=false/);
 assert.match(text,/integrations\.auto_sync=false/);
 assert.match(defaults.hard_stops.join("\n"),/billing-insert source paths/);
 assert.match(defaults.hard_stops.join("\n"),/admin branch/);
 assert.equal(plan.approved_for_execution,false);
});
