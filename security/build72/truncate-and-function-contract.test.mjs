import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const source=JSON.parse(read("security/build72/live-truncate-and-function-acl-snapshot.json"));
const sql=read("security/build72/all-19-anon-truncate-rls-bypass.rollback.sql");
const original=read("security/build40/19-table-13-view-source-shaped.integration.sql");
const views=JSON.parse(read("security/build71/live-public-view-acl-snapshot.json"));
test("19 current live tables all have RLS and anon+authenticated TRUNCATE privilege",()=>{
 assert.equal(source.public_table_count,19);
 assert.equal(source.tables.length,19);
 assert.equal(source.anon_truncate_count,19);
 assert.equal(source.authenticated_truncate_count,19);
 assert.equal(source.rls_enabled_count,19);
 assert.equal(new Set(source.tables.map(t=>t.table_name)).size,19);
 assert.ok(source.tables.every(t=>t.owner_role==="postgres"&&t.rls_enabled&&
  t.anon_truncate&&t.authenticated_truncate));
 assert.equal(source.production_remediation_accepted,0);
 assert.equal(source.read_only,true);
 assert.equal(source.no_live_db_changes,true);
});
test("all 19 exact source-shaped tables, invented IDs and both privilege transitions are checked",()=>{
 for(const t of source.tables){
  const m=original.match(new RegExp("^CREATE TABLE public\\."+t.table_name+"\\([^;]+;","m"));
  assert.ok(m,"missing exact source table "+t.table_name);
  assert.ok(sql.includes(m[0]),"source table changed "+t.table_name);
  assert.ok(sql.includes("ALTER TABLE public."+t.table_name+" ENABLE ROW LEVEL SECURITY;"));
  assert.ok(sql.includes("INSERT INTO public."+t.table_name+"(\"id\") VALUES"));
 }
 assert.equal((sql.match(/^CREATE TABLE public\./gm)||[]).length,19);
 assert.equal((sql.match(/^INSERT INTO public\./gm)||[]).length,19);
 assert.equal((sql.match(/^ALTER TABLE public\.[a-z_]+ ENABLE ROW LEVEL SECURITY;/gm)||[]).length,19);
 assert.match(sql,/GRANT TRUNCATE ON public\.app_settings/);
 assert.match(sql,/REVOKE TRUNCATE ON public\.app_settings/);
 assert.match(sql,/DO \$attack\$/);
 assert.match(sql,/DO \$secure\$/);
 assert.match(sql,/DO \$cleared\$/);
 assert.match(sql,/IF n<>0 THEN RAISE EXCEPTION 'RLS should hide/);
 assert.match(sql,/EXECUTE format\('TRUNCATE TABLE public\.\%I',t\)/);
 assert.match(sql,/EXCEPTION WHEN insufficient_privilege THEN/);
});
test("function source scope has 16 actual anon executable SECURITY DEFINER functions",()=>{
 assert.equal(source.security_definer_function_count,16);
 assert.equal(source.security_definer_functions.length,16);
 assert.equal(source.anon_execute_security_definer_count,16);
 assert.equal(source.missing_function_search_path_count,2);
 assert.equal(source.public_search_path_function_count,13);
 const f=source.security_definer_functions;
 assert.equal(new Set(f.map(x=>x.signature)).size,16);
 assert.ok(f.every(x=>x.owner_role==="postgres"&&x.security_definer&&x.anon_execute));
 assert.ok(f.every(x=>/^[0-9a-f]{32}$/.test(x.definition_md5)));
 assert.deepEqual(f.filter(x=>x.function_config===null).map(x=>x.function_name),
  ["set_assigned_recruiter","track_stage_changes"]);
 assert.ok(f.some(x=>x.function_name==="generate_reminders"));
 assert.ok(f.some(x=>x.function_name==="run_workflow_rules"));
});
test("complete live 48-object risk surface tracks 19 tables, 13 views and 16 functions",()=>{
 assert.equal(source.public_table_count+views.view_count+source.security_definer_function_count,48);
 assert.equal(views.anon_select_granted_count,13);
 assert.equal(views.noninvoker_views,13);
 assert.equal(views.all_views_owned_by_postgres,true);
 assert.equal(source.no_business_records_retrieved,true);
});
test("synthetic PostgreSQL exploit rehearsal has no hosted targets, no COMMIT and mandatory rollback",()=>{
 assert.match(sql,/^-- Build72 SYNTHETIC DISPOSABLE PostgreSQL 17 ONLY/);
 assert.match(sql,/\nBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(sql,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/(?:^|\n)\s*COMMIT\s*;/i);
 assert.doesNotMatch(sql,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.doesNotMatch(sql,/http:|https:|pg_sleep\(/);
 assert.doesNotMatch(sql,/\bCOPY\s+public\./i);
 assert.match(sql,/CREATE ROLE b72_anon NOLOGIN/);
 assert.match(sql,/SET LOCAL ROLE b72_anon/);
 assert.match(sql,/RESET ROLE/);
});
