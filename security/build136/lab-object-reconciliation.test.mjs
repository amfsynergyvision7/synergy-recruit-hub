import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path=file=>new URL("../../"+file,import.meta.url);
const src=file=>readFileSync(path(file),"utf8");
const lab=JSON.parse(src("security/build136/read-only-lab-object-evidence.json"));
const historic=JSON.parse(src("security/build47/catalog-inventory.json"));
const sql=src("security/build136/lab-readonly-reconciliation.sql");
const sorted=list=>[...list].sort();

test("Build136 lab inventory uses a uniquely identified, strictly read-only isolated project",()=>{
 assert.equal(lab.build,136);
 assert.equal(lab.project_id,"dhlhlasnaapzckjyvffn");
 assert.equal(lab.environment.includes("NOT production"),true);
 assert.equal(lab.no_database_mutations,true);
 assert.equal(lab.signoff_status,"NOT independently reviewed or accepted");
});

test("Build136 list matches all 19 historical production reference table names",()=>{
 assert.equal(lab.public_tables.length,19);
 assert.deepEqual(sorted(lab.public_tables),sorted(historic.objects.tables));
 assert.equal(new Set(lab.public_tables).size,19);
});

test("Build136 list matches all 13 historical production reference view names",()=>{
 assert.equal(lab.public_views.length,13);
 assert.deepEqual(sorted(lab.public_views),sorted(historic.objects.views));
 assert.equal(new Set(lab.public_views).size,13);
});

test("Build136 lab has only seven of historic sixteen privileged function names",()=>{
 const labNames=lab.public_security_definer_functions.map(s=>s.slice(0,s.indexOf("(")));
 assert.equal(labNames.length,7);
 assert.equal(new Set(labNames).size,7);
 assert.equal(historic.objects.functions.length,16);
 assert.deepEqual(lab.release_differences.lab_missing_reference_function_names,
   historic.objects.functions.filter(name=>!labNames.includes(name)));
 assert.deepEqual(lab.release_differences.lab_unexpected_function_names,[]);
 assert.equal(lab.release_differences.lab_missing_reference_function_names.length,9);
});

test("Build136 lists exact auth-critical functions absent from this LAB, not live production",()=>{
 const missing=lab.release_differences.lab_missing_reference_function_names;
 for(const name of ["get_user_role","has_role","is_approved","handle_new_user",
   "resolve_candidate_uuid","resolve_client_uuid","resolve_job_uuid",
   "rls_auto_enable","generate_reminders"])
   assert(missing.includes(name),name);
 assert.equal(lab.release_differences.historical_production_reference_is_not_live_verification,true);
 assert.equal(lab.release_differences.no_sql_changes_to_reconcile_difference,true);
 assert.equal(lab.release_differences.difference_is_not_proof_of_missing_production_functions,true);
});

test("Build136 all public lab base tables have forced RLS and all views use invoker",()=>{
 const c=lab.aggregate;
 assert.equal(c.public_tables,19);
 assert.equal(c.rls_enabled_tables,19);
 assert.equal(c.force_rls_tables,19);
 assert.equal(c.public_views,13);
 assert.equal(c.security_invoker_views,13);
});

test("Build136 isolated lab grants no table/view SELECT or secdef EXECUTE to browser roles",()=>{
 const c=lab.aggregate;
 for(const key of ["anon_table_select_grants","authenticated_table_select_grants",
 "anon_view_select_grants","authenticated_view_select_grants",
 "anon_security_definer_execute_grants","authenticated_security_definer_execute_grants"])
  assert.equal(c[key],0,key);
});

test("Build136 zero users and policies must not count as signed hosted Auth success",()=>{
 const c=lab.aggregate;
 assert.equal(c.auth_users,0);
 assert.equal(c.public_policies,0);
 assert.equal(c.enabled_public_application_triggers,0);
 assert.equal(c.actual_rows_across_each_of_19_public_tables,0);
 assert.equal(lab.release_differences.independently_signed_hosted_test_count,0);
 assert.equal(lab.release_differences.independently_accepted_production_remediation_count,0);
 assert.equal(lab.release_differences.access_status.startsWith("DENY BY DEFAULT"),true);
});

test("Build136 numeric object gap is nine in this lab, not accepted production remediation",()=>{
 assert.equal(lab.release_differences.production_review_expected_security_object_count,48);
 assert.equal(lab.release_differences.lab_visible_review_object_count,39);
 assert.equal(lab.release_differences.numeric_function_inventory_difference,9);
 assert.equal(lab.release_differences.production_review_expected_counts.privileged_functions,16);
 assert.equal(lab.release_differences.lab_review_counts.security_definer_functions,7);
 assert.equal(19+13+7,39);
 assert.equal(19+13+16,48);
});

test("Build136 SQL is a READ-ONLY reproduction recipe without DDL/DML",()=>{
 const commands=sql.split("\n").filter(l=>!l.trim().startsWith("--")).join("\n");
 assert(/\bWITH relation_inventory AS\b/.test(commands));
 assert(/\bSELECT jsonb_build_object\(/.test(commands));
 assert(/\bFROM auth\.users\b/.test(commands));
 assert(/\bpg_catalog\.pg_proc\b/.test(commands));
 assert(/\bpg_catalog\.pg_class\b/.test(commands));
 assert(/\bhas_table_privilege\b/.test(commands));
 assert(/\bhas_function_privilege\b/.test(commands));
 assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO|COPY)\b/i.test(commands));
 assert(!/\bEXECUTE\s+(?:PROCEDURE|FUNCTION)/i.test(commands));
});

test("Build136 SQL source does not select identity, email, resume, salary or record values",()=>{
 assert(!sql.includes("SELECT *"));
 assert(!sql.includes("SELECT email"));
 assert(!sql.includes("SELECT phone"));
 assert(!sql.includes("SELECT full_name"));
 assert(!sql.includes("SELECT resume_url"));
 assert(!sql.includes("FROM auth.sessions"));
});

test("Build136 production scope remains separate from lab and needs independent owner",()=>{
 assert.equal(historic.scope.includes("production metadata"),true);
 assert.equal(historic.release.production_changed,false);
 assert.equal(lab.release_differences.historical_production_reference_date,"2026-11-11");
 assert.equal(lab.independent_owner_required.length,5);
 assert(lab.independent_owner_required.some(s=>s.includes("Audit actual production schema separately")));
});

test("Build136 catalog has no privileged access keys or user secrets",()=>{
 const contents=src("security/build136/read-only-lab-object-evidence.json");
 for(const key of ["SUPABASE_SERVICE_ROLE_KEY","JWT_SECRET","PASSWORD=","access_token","refresh_token"])
  assert(!contents.includes(key),key);
});
