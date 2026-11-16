import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>JSON.parse(readFileSync(new URL("../../"+name,import.meta.url),"utf8"));
const plan=read("security/build137/nonprod-auth-parity-review.json");
const lab=read("security/build136/read-only-lab-object-evidence.json");
const historic=read("security/build72/live-function-public-acl-snapshot.json");
const ref=read("security/build47/catalog-inventory.json");

test("Build137 nonproduction parity plan never claims a production read or release",()=>{
 assert.equal(plan.build,137);
 assert.equal(plan.lab_project_id,"dhlhlasnaapzckjyvffn");
 assert.equal(plan.status,"REVIEW_HANDOFF_ONLY__ZERO_GATES_CLOSED");
 assert.match(plan.note,/historical production-reviewed inventory/);
});

test("Build137 complete signatures equal exact historic signatures not visible in lab",()=>{
 const names=new Set(lab.public_security_definer_functions.map(x=>x.split("(")[0]));
 const expected=historic.rows.filter(x=>!names.has(x.function_name)).map(x=>x.signature).sort();
 const observed=plan.historically_expected_not_present_in_lab.map(x=>x.signature).sort();
 assert.deepEqual(observed,expected);
 assert.equal(expected.length,9);
 assert.equal(new Set(observed).size,9);
});

test("Build137 first priority role and approval helpers are clearly named",()=>{
 const p0=plan.historically_expected_not_present_in_lab.filter(x=>x.priority==="P0");
 assert.equal(p0.length,4);
 for(const x of ["get_user_role(uuid)","has_role(uuid,app_role)","is_approved(uuid)","handle_new_user()"])
 assert(p0.some(y=>y.signature===x),x);
});

test("Build137 legacy mappings and automation are separate review categories",()=>{
 const refs=plan.historically_expected_not_present_in_lab;
 assert.equal(refs.filter(x=>x.category==="legacy_reference_resolution").length,3);
 assert.equal(refs.find(x=>x.signature==="generate_reminders()")?.priority,"P2");
 assert(refs.every(x=>typeof x.next_action==="string"&&x.next_action.length>=30));
});

test("Build137 exact table and view inventory remains unchanged, 7 lab vs 16 historical function count",()=>{
 const c=plan.observed_readonly;
 assert.equal(c.public_tables,ref.objects.tables.length);
 assert.equal(c.public_views,ref.objects.views.length);
 assert.equal(c.forced_rls_tables,19);
 assert.equal(c.security_invoker_views,13);
 assert.equal(c.lab_public_security_definer_functions,7);
 assert.equal(historic.rows.length,16);
});

test("Build137 anonymous/authenticated table authorization not fabricated for empty test lab",()=>{
 const c=plan.observed_readonly;
 assert.equal(c.auth_users,0);
 assert.equal(c.public_rls_policies,0);
 assert.equal(c.enabled_public_application_triggers,0);
 assert.equal(c.anon_table_select_grants,0);
 assert.equal(c.authenticated_table_select_grants,0);
 assert.equal(c.independently_counted_public_tables,19);
 assert.equal(c.all_public_table_rows,0);
});

test("Build137 external main review and secret protection cannot self-certify",()=>{
 const b=plan.blockers;
 assert.equal(b.main_protected,false);
 assert.equal(b.main_rulesets,0);
 assert.equal(b.auth_pr15_independent_submitted_reviews,0);
 assert.equal(b.auth_pr15_merged,false);
 assert.equal(b.protected_github_environment_config_verified,false);
 assert.match(b.protected_environment_verification_reason,/unknown/);
});

test("Build137 owner sequence explicitly separates review and actual hosted mutation",()=>{
 assert.equal(plan.independent_owner_sequence.length,6);
 assert(plan.independent_owner_sequence.some(x=>x.includes("without printing")));
 assert(plan.independent_owner_sequence.some(x=>x.includes("separately authorized production inventory")));
 assert(plan.independent_owner_sequence.some(x=>x.includes("9 fictional Auth subjects and 38 inert rows")));
 assert(plan.independent_owner_sequence.some(x=>x.includes("negative role access")));
});

test("Build137 JSON is only an inert review record, no credential material",()=>{
 const raw=readFileSync(new URL("../../security/build137/nonprod-auth-parity-review.json",import.meta.url),"utf8");
 for(const banned of ["service_role_key","PASSWORD=","JWT_SECRET","SUPABASE_SERVICE_ROLE_KEY","BEGIN TRANSACTION","DROP FUNCTION"])
  assert(!raw.includes(banned),banned);
});

test("Build137 pending formal work is not counted as accepted",()=>{
 const b=plan.blockers;
 for(const k of ["auth_users_provisioned","inert_rows_seeded","signed_role_uat_accepted",
                  "production_security_remediations_accepted","release_signoffs_accepted"])
  assert.equal(b[k],0,k);
});
