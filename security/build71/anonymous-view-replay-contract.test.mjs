import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const source=JSON.parse(readFileSync("security/build71/all-13-live-view-sources.json","utf8"));
const sql=readFileSync("security/build71/all-13-view-anonymous-exposure.rollback.sql","utf8");
const inventory=JSON.parse(readFileSync("security/build65/production-hosted-coverage.json","utf8"));
test("all thirteen original live view source definitions match PostgreSQL MD5 and source replay",()=>{
 assert.equal(source.source_count,13);
 assert.deepEqual(source.source_views.map(v=>v.name),inventory.production_public_views);
 for(const v of source.source_views){
  assert.equal(createHash("md5").update(v.sql).digest("hex"),v.md5,v.name);
  assert.ok(sql.includes("Live pg_get_viewdef md5 "+v.md5),v.name);
  assert.ok(sql.includes("CREATE VIEW public."+v.name+" AS\n"+v.sql.trim().replace(/;\s*$/,"")+";"),v.name);
  assert.ok(sql.includes("ALTER VIEW public."+v.name+" SET (security_invoker=true);"),v.name);
 }
 assert.equal((sql.match(/^CREATE VIEW public\./gm)||[]).length,13);
 assert.equal((sql.match(/^ALTER VIEW public\./gm)||[]).length,13);
});
test("script proves three independent layers against all thirteen anonymous exposures",()=>{
 assert.match(sql,/DO \$unsafe\$/);
 assert.match(sql,/Expected one invented row leaked by definer view/);
 assert.match(sql,/DO \$invoker\$/);
 assert.match(sql,/Invoker view % unexpectedly readable anonymously/);
 assert.match(sql,/DO \$rls\$/);
 assert.match(sql,/Anonymous billing rows leaked despite RLS/);
 assert.match(sql,/DO \$denied\$/);
 assert.match(sql,/Revoked view % unexpectedly readable anonymously/);
 assert.match(sql,/GRANT SELECT ON public\.billing TO b71_anon/);
 assert.match(sql,/REVOKE SELECT ON public\.available_recruiters/);
 assert.equal((sql.match(/FOREACH view_name IN ARRAY ARRAY\[/g)||[]).length,3);
 assert.equal((sql.match(/ALTER TABLE public\.[a-z_]+ ENABLE ROW LEVEL SECURITY;/g)||[]).length,8);
});
test("the entire exposure test is synthetic and rolled back",()=>{
 assert.match(sql,/^-- Build71 DISPOSABLE PostgreSQL 17 ONLY/);
 assert.match(sql,/\nBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(sql,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/(?:^|\n)\s*COMMIT\s*;/i);
 assert.doesNotMatch(sql,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.match(sql,/example\.invalid/);
 assert.doesNotMatch(sql,/\bCOPY\s+public\./i);
 assert.equal(source.not_applied_to_live_database,true);
 assert.equal(source.proposed_public_release_hold,true);
});
test("integration uses exact eight view source table declarations from established disposable baseline",()=>{
 const basis=readFileSync("security/build40/19-table-13-view-source-shaped.integration.sql","utf8");
 for(const table of ["billing","candidates","clients","interviews","job_openings","offers","profiles","submissions"]){
  const pattern=new RegExp("^CREATE TABLE public\\."+table+"\\([^;]+;","m");
  const m=basis.match(pattern);
  assert.ok(m,"missing baseline table "+table);
  assert.ok(sql.includes(m[0]),"table DDL drift "+table);
 }
});

test("actual current production metadata confirms all thirteen anon-readable, non-invoker views",()=>{
 const acl=JSON.parse(readFileSync("security/build71/live-public-view-acl-snapshot.json","utf8"));
 assert.equal(acl.view_count,13);
 assert.equal(acl.anon_select_granted_count,13);
 assert.equal(acl.noninvoker_views,13);
 assert.equal(acl.all_views_owned_by_postgres,true);
 assert.equal(acl.remediation_accepted,0);
 assert.equal(acl.live_database_modified,false);
 assert.deepEqual(acl.observed_views.map(x=>x.view_name),inventory.production_public_views);
 for(const row of acl.observed_views){
  assert.equal(row.anon_select_granted,true,row.view_name);
  assert.equal(row.security_invoker,false,row.view_name);
  assert.equal(row.view_owner_role,"postgres",row.view_name);
  assert.match(row.definition_md5,/^[0-9a-f]{32}$/);
  assert.equal(row.definition_md5,source.source_views.find(v=>v.name===row.view_name)?.md5);
 }
});
