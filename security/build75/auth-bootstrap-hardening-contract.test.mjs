import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(p,"utf8");
const sql=read("security/build75/auth-bootstrap-no-email-admin.rollback.sql");
const oldSource=read("security/build40/19-table-13-view-source-shaped.integration.sql");
const observed=JSON.parse(read("security/build75/live-trigger-and-auth-hook-manifest.json"));
test("auth bootstrap hardening uses exactly production-shaped profiles and roles DDL",()=>{
 for(const name of ["profiles","user_roles"]){
  const exact=oldSource.match(new RegExp("^CREATE TABLE public\\."+name+"\\([^;]+;","m"));
  assert.ok(exact,name+" source missing");
  assert.ok(sql.includes(exact[0]),name+" not source shaped");
 }
 for(const ty of ["app_role","user_status"]){
  const exact=oldSource.match(new RegExp("^CREATE TYPE public\\."+ty+"[^;]+;","m"));
  assert.ok(exact,ty+" enum source missing");
  assert.ok(sql.includes(exact[0]));
 }
 assert.match(sql,/ALTER TABLE public\.profiles ADD CONSTRAINT b75_profiles_pk PRIMARY KEY\(id\)/);
 assert.match(sql,/ALTER TABLE public\.user_roles ADD CONSTRAINT b75_user_roles_uid_uq UNIQUE\(user_id\)/);
});
test("real production hook is source-hashed and has an email-conditioned admin branch",()=>{
 assert.equal(observed.auth_user_trigger_count,1);
 assert.equal(observed.auth_user_triggers[0].function_md5,"46329135f1c4754fe71fe5d6a81bed36");
 assert.equal(observed.auth_user_triggers[0].inserts_profile,true);
 assert.equal(observed.auth_user_triggers[0].inserts_role,true);
 assert.equal(observed.auth_user_triggers[0].email_condition,true);
 assert.equal(observed.auth_user_triggers[0].privileged_email_branch,true);
});
test("proposed new registrations are pending inactive viewer, never email/metadata based admin",()=>{
 assert.match(sql,/SECURITY DEFINER\s+SET search_path TO 'pg_catalog'/);
 assert.match(sql,/VALUES \(NEW\.id,'viewer'::public\.app_role\)/);
 assert.match(sql,/'pending'::public\.user_status,\s*false/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC,b75_new_registration_actor/);
 assert.match(sql,/role_request":"admin"/);
 assert.match(sql,/Registration created an unauthorized admin/);
 assert.match(sql,/New synthetic registration is incorrectly approved or active/);
 assert.doesNotMatch(sql,/(?:^|\n)\s*(?:GRANT|INSERT)\s+[^;\n]*'admin'::public\.app_role/i);
 assert.doesNotMatch(sql,/@gmail\.com|@outlook\.com|@yahoo\./i);
});
test("never executes outside exact disposable PG and never commits/changes hosted Supabase",()=>{
 assert.match(sql,/^-- Build75: NONDEPLOYABLE lab-only candidate/);
 assert.match(sql,/current_database\(\)<>'amf_build75_auth_lab'/);
 assert.match(sql,/\nBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(sql,/^ROLLBACK;\s*$/m);
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,0);
 assert.doesNotMatch(sql,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.doesNotMatch(sql,/\bCOPY\s+auth\.users/i);
});
