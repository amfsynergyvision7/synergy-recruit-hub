import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const doc=JSON.parse(readFileSync("security/build73/live-permission-gate-observation.json","utf8"));
const expectStatus="HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT";
test("live source-gate evidence is from the exact nonmutating catalog query in both projects",()=>{
 assert.equal(doc.evidence_type,"ACTUAL_READ_ONLY_48_OBJECT_PERMISSION_GATE_TWO_PROJECTS");
 assert.equal(doc.observed_date,"2026-11-12");
 assert.equal(doc.source_sql,"security/build73/48-object-release-preflight.readonly.sql");
 assert.match(doc.source_blob_sha,/^[0-9a-f]{40}$/);
 assert.equal(doc.write_operations_performed,0);
 assert.equal(doc.projects.length,2);
 assert.deepEqual(doc.projects.map(p=>p.scope),["production","synthetic_nonproduction"]);
 assert.deepEqual(doc.projects.map(p=>p.project_ref),
  ["wusntntcqgtpgokggdzv","dhlhlasnaapzckjyvffn"]);
});
test("actual production 48-object permission gate remains HOLD, never accepted as completed remediation",()=>{
 const p=doc.projects[0];
 assert.equal(p.permissions_gate,expectStatus);
 assert.equal(p.actual_public_tables,19);
 assert.equal(p.matched_tables,19);
 assert.equal(p.tables_rls_enabled,19);
 assert.equal(p.anon_truncate_tables,19);
 assert.equal(p.authenticated_truncate_tables,19);
 assert.equal(p.actual_public_views,13);
 assert.equal(p.matched_views,13);
 assert.equal(p.invoker_views,0);
 assert.equal(p.anonymous_readable_views,13);
 assert.equal(p.actual_privileged_functions,16);
 assert.equal(p.matched_privileged_functions,16);
 assert.equal(p.anonymous_executable_functions,16);
 assert.equal(p.public_executable_functions,9);
 assert.equal(p.authenticated_executable_functions,16);
});
test("dedicated nonproduction has zero 48-object fixtures and explicitly fails closed",()=>{
 const p=doc.projects[1];
 assert.equal(p.permissions_gate,expectStatus);
 for(const field of [
  "actual_public_tables","matched_tables","tables_rls_enabled",
  "actual_public_views","matched_views","invoker_views",
  "actual_privileged_functions","matched_privileged_functions"
 ])assert.equal(p[field],0,field);
 assert.equal(doc.accepted_production_remediations,0);
 assert.equal(doc.accepted_real_hosted_authorization_cases,0);
 assert.equal(doc.formal_release_signatures,0);
 assert.match(doc.notice,/not an approval/);
});
