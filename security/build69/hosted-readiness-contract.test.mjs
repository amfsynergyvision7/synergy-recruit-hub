import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(p,"utf8");
const inventory=JSON.parse(read("security/build65/production-hosted-coverage.json"));
const sql=read("security/build69/hosted-fixture-readiness.readonly.sql");
const strip=sql.replace(/^\s*--.*$/gm,"").trim();
const parseNames=(part)=>[...part.matchAll(/\('([a-z_]+)'\)/g)].map(m=>m[1]);

test("read-only hosted preflight pins all actual nineteen tables and thirteen views",()=>{
 const tablePart=strip.split("WITH expected_tables(name) AS (VALUES")[1]?.split("), expected_views(name) AS (VALUES")[0];
 const viewPart=strip.split("), expected_views(name) AS (VALUES")[1]?.split("), got_tables AS (")[0];
 assert.ok(tablePart&&viewPart,"missing one of the pinned scope lists");
 assert.equal(parseNames(tablePart).length,19);
 assert.equal(parseNames(viewPart).length,13);
 assert.deepEqual(parseNames(tablePart),inventory.production_public_tables);
 assert.deepEqual(parseNames(viewPart),inventory.production_public_views);
 assert.equal(new Set(parseNames(tablePart)).size,19);
 assert.equal(new Set(parseNames(viewPart)).size,13);
});

test("the nonproduction preflight refuses incomplete schema, RLS, view, grant or identity scope",()=>{
 for(const required of [
  "auth_user_count>=9","actual_public_tables=19","expected_tables_found=19",
  "actual_public_views=13","expected_views_found=13","expected_tables_rls=19",
  "expected_anon_truncate_grants=0","expected_security_invoker_views=13",
  "expected_anon_readable_views=0","candidate_history_policy_count>0",
  "HOLD_NONPRODUCTION_SCHEMA_OR_SECURITY_PREREQUISITES_ABSENT",
  "SCHEMA_PREFLIGHT_PASS_NEEDS_INDEPENDENT_FIXTURE_AND_AUTH_UAT"
 ])assert.ok(strip.includes(required), "missing critical check "+required);
 assert.match(strip,/SELECT count\(\*\) FROM auth\.users/);
 assert.match(strip,/has_table_privilege\('anon',c\.oid,'TRUNCATE'\)/);
 assert.match(strip,/security_invoker=true/);
 assert.match(strip,/pg_catalog\.pg_policies/);
});

test("readiness preflight is one nonmutating catalog/count SELECT, never a fixture installer",()=>{
 assert.match(strip,/^WITH expected_tables\(name\) AS \(VALUES/);
 assert.equal((strip.match(/;/g)||[]).length,1);
 assert.match(strip,/FROM observed;$/);
 assert.doesNotMatch(strip,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|DO|CALL|EXECUTE|COPY|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(strip,/\bpg_get_functiondef\s*\(/i);
 assert.doesNotMatch(strip,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
 assert.doesNotMatch(strip,/\bto_email\b|\bfull_name\b|\bpassword\b/i);
});
