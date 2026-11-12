import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const current=JSON.parse(read("security/build72/live-function-public-acl-snapshot.json"));
const baseline=JSON.parse(read("security/build72/live-truncate-and-function-acl-snapshot.json"));
const sql=read("security/build72/all-16-function-public-fallback.rollback.sql");
const stubs=read("security/build40/16-security-definer-acl.integration.sql");
test("live production has nine PUBLIC fallback EXECUTE and sixteen direct anon grants",()=>{
 assert.equal(current.security_definer_count,16);
 assert.equal(current.rows.length,16);
 assert.equal(current.public_execute_count,9);
 assert.equal(current.explicit_anon_execute_count,16);
 assert.equal(current.read_only,true);
 assert.equal(current.production_changed,false);
 assert.equal(current.rows.filter(x=>x.public_execute).length,9);
 assert.equal(current.rows.filter(x=>x.explicit_anon_execute).length,16);
 assert.equal(new Set(current.rows.map(x=>x.signature)).size,16);
 assert.deepEqual(current.rows.map(x=>x.signature),
  baseline.security_definer_functions.map(x=>x.signature));
});
test("disposable test uses all sixteen existing safe stubs and exactly nine live PUBLIC grants",()=>{
 const actualStubs=stubs.split("\n").filter(line=>line.startsWith("CREATE FUNCTION public."));
 assert.equal(actualStubs.length,16);
 for(const stub of actualStubs)assert.ok(sql.includes(stub));
 for(const item of current.rows){
  const signature="public."+item.signature.replace(/app_role/g,"public.app_role");
  assert.ok(sql.includes(signature),"missing signature "+signature);
 }
 assert.equal((sql.match(/^CREATE FUNCTION public\./gm)||[]).length,16);
 const grants=sql.match(/^GRANT EXECUTE ON FUNCTION .* TO PUBLIC;$/gm)||[];
 assert.equal(grants.length,1);
 for(const row of current.rows.filter(x=>x.public_execute))
  assert.ok(grants[0].includes("public."+row.signature.replace(/app_role/g,"public.app_role")));
});
test("tests failed anon-only revoke, correct PUBLIC revoke and three role-helper allowances",()=>{
 assert.match(sql,/DO \$baseline\$/);
 assert.match(sql,/total<>16 OR public_count<>9 OR direct_count<>16/);
 assert.match(sql,/REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM b72_fn_anon/);
 assert.match(sql,/DO \$public_fallback\$/);
 assert.match(sql,/IF n<>9 THEN RAISE EXCEPTION 'PUBLIC fallback expected 9/);
 assert.match(sql,/REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC/);
 assert.match(sql,/DO \$no_anon\$/);
 assert.match(sql,/IF n<>0 THEN RAISE EXCEPTION 'Anonymous function EXECUTE still inherited/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.get_user_role\(uuid\), public\.has_role\(uuid,public\.app_role\), public\.is_approved\(uuid\) TO b72_fn_authenticated/);
 assert.match(sql,/IF n<>3 OR unsafe<>0 THEN RAISE EXCEPTION/);
});
test("never calls function body and never commits outside disposable PostgreSQL",()=>{
 assert.match(sql,/^-- Build72 disposable PostgreSQL 17 function-permission rehearsal ONLY/);
 assert.match(sql,/\nBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(sql,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/(?:^|\n)\s*COMMIT\s*;/i);
 assert.doesNotMatch(sql,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.doesNotMatch(sql,/CALL public\.|SELECT public\./);
 assert.match(sql,/CREATE ROLE b72_fn_anon NOLOGIN/);
});
