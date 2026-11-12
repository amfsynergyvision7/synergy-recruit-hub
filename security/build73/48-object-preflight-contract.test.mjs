import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const read=p=>readFileSync(p,"utf8");
const gate=read("security/build73/48-object-release-preflight.readonly.sql");
const replay=read("security/build73/48-object-permission-before-after.rollback.sql");
const tables=JSON.parse(read("security/build65/production-hosted-coverage.json"));
const views=JSON.parse(read("security/build71/all-13-live-view-sources.json")).source_views;
const functionAcl=JSON.parse(read("security/build72/live-function-public-acl-snapshot.json")).rows;
const tableSource=read("security/build40/19-table-13-view-source-shaped.integration.sql");
const functionSource=read("security/build40/16-security-definer-acl.integration.sql");

const names=(s,begin,end)=>{
 const part=s.split(begin)[1]?.split(end)[0];
 assert.ok(part,"Missing exact source VALUES list "+begin);
 return [...part.matchAll(/\('([^']+)'\)/g)].map(x=>x[1]);
};
test("read-only SQL requires exact 19 tables, 13 views and 16 source signatures",()=>{
 assert.deepEqual(names(gate,"WITH expected_tables(name) AS (VALUES", "), expected_views(name) AS (VALUES"),
  tables.production_public_tables);
 assert.deepEqual(names(gate,"), expected_views(name) AS (VALUES", "), expected_functions(signature) AS (VALUES"),
  tables.production_public_views);
 assert.deepEqual(names(gate,"), expected_functions(signature) AS (VALUES", "), tab AS ("),
  functionAcl.map(x=>"public."+x.signature.replace(/app_role/g,"public.app_role")));
 assert.equal(new Set(names(gate,"), expected_functions(signature) AS (VALUES", "), tab AS (")).size,16);
 assert.match(gate,/^-- Build73 READ-ONLY catalog-only 48-object permission preflight/);
 assert.match(gate,/^WITH expected_tables\(name\) AS \(VALUES/m);
 assert.equal((gate.match(/;/g)||[]).length,1);
 assert.match(gate,/FROM aggregate;\s*$/);
 assert.doesNotMatch(gate,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(gate,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
});
test("fail-closed permission gate includes all 48 objects, no false production release pass",()=>{
 for(const marker of [
  "matched_tables=19","actual_public_tables=19","tables_rls_enabled=19",
  "anon_truncate_tables=0","authenticated_truncate_tables=0",
  "matched_views=13","actual_public_views=13","invoker_views=13","anonymous_readable_views=0",
  "matched_privileged_functions=16","actual_privileged_functions=16",
  "anonymous_executable_functions=0","public_executable_functions=0",
  "authenticated_executable_functions=3",
  "HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT",
  "PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL"
 ])assert.ok(gate.includes(marker),"Missing postflight blocker "+marker);
 assert.match(gate,/aclexplode/);
 assert.match(gate,/has_table_privilege/);
 assert.match(gate,/has_function_privilege/);
 assert.match(gate,/security_invoker=true/);
 assert.ok(!gate.includes("CREATE ROLE"));
});
test("single disposable SQL script reproduces all nineteen exact source DDLs",()=>{
 const sourceTables=[...tableSource.matchAll(/^CREATE TABLE public\.([a-z_]+)\([^;]+;/gm)];
 assert.equal(sourceTables.length,19);
 assert.equal((replay.match(/^CREATE TABLE public\./gm)||[]).length,19);
 for(const match of sourceTables){
  assert.ok(replay.includes(match[0]),"Source table DDL changed "+match[1]);
  assert.ok(replay.includes("ALTER TABLE public."+match[1]+" ENABLE ROW LEVEL SECURITY;"));
 }
 const srcTypes=[...tableSource.matchAll(/^CREATE TYPE public\.(?:app_role|user_status|candidate_stage)[^;]+;/gm)];
 assert.equal(srcTypes.length,3);
 for(const [source] of srcTypes)assert.ok(replay.includes(source));
});
test("thirteen source-exact view definitions and sixteen harmless source-signature stubs",()=>{
 assert.equal(views.length,13);
 for(const v of views){
  assert.equal(createHash("md5").update(v.sql).digest("hex"),v.md5,v.name);
  assert.ok(replay.includes("CREATE VIEW public."+v.name+" AS\n"+
   v.sql.trim().replace(/;\s*$/,"")+";"),v.name);
  assert.ok(replay.includes("ALTER VIEW public."+v.name+" SET (security_invoker=true);"),v.name);
 }
 assert.equal((replay.match(/^CREATE VIEW public\./gm)||[]).length,13);
 assert.equal((replay.match(/^ALTER VIEW public\./gm)||[]).length,13);
 const funcs=functionSource.split("\n").filter(x=>x.startsWith("CREATE FUNCTION public."));
 assert.equal(funcs.length,16);
 for(const f of funcs)assert.ok(replay.includes(f),"Function stub source drift");
 assert.equal((replay.match(/^CREATE FUNCTION public\./gm)||[]).length,16);
 assert.equal(functionAcl.filter(x=>x.public_execute).length,9);
});
test("one rollback-only transaction, exact disposable DB guard and verified before/after counts",()=>{
 assert.match(replay,/^-- Build73: 48-object permission preflight/);
 assert.match(replay,/\nBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(replay,/current_database\(\)<>'amf_build73_permissions_lab'/);
 assert.match(replay,/^ROLLBACK;\s*$/m);
 assert.equal((replay.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((replay.match(/^BEGIN;$/gm)||[]).length,1);
 assert.doesNotMatch(replay,/(?:^|\n)\s*COMMIT\s*;/im);
 assert.doesNotMatch(replay,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.match(replay,/b73_permissions_gate/);
 assert.match(replay,/p\.public_executable_functions <> 9/);
 assert.match(replay,/p\.public_executable_functions <> 0/);
 assert.match(replay,/p\.anonymous_executable_functions <> 16/);
 assert.match(replay,/p\.anonymous_executable_functions <> 0/);
 assert.match(replay,/p\.authenticated_executable_functions <> 3/);
 assert.match(replay,/pg_catalog\.pg_policies WHERE schemaname='public'/);
 assert.match(replay,/PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL/);
 assert.match(replay,/has_table_privilege\('b73_anon',c\.oid,'TRUNCATE'\)/);
 assert.match(replay,/has_function_privilege\('b73_authenticated',p\.oid,'EXECUTE'\)/);
 assert.doesNotMatch(replay,/has_table_privilege\('anon',c\.oid,'TRUNCATE'\)/);
 assert.ok(replay.includes("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,b73_fn_anon")===false);
});
