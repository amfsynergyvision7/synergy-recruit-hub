import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildPostflight,compose,approvedRpcs,originalFixture,combinedFixture}
 from "./compose-postrelease-permission-check.mjs";

const read=p=>readFileSync(p,"utf8");
const originalGate=read("security/build73/48-object-release-preflight.readonly.sql");
const sources=Object.fromEntries(approvedRpcs.map(([,p])=>[p,read(p)]));
const postflight=buildPostflight(originalGate,sources);

test("exact six reviewed CRM functions are SECURITY DEFINER and authenticated-only",()=>{
 assert.equal(approvedRpcs.length,6);
 assert.equal(new Set(approvedRpcs.map(x=>x[0])).size,6);
 for(const [sig,sourceFile,name] of approvedRpcs){
  const c=sources[sourceFile];
  assert.ok(c.includes("CREATE OR REPLACE FUNCTION public."+name+"("));
  assert.ok(c.includes("GRANT EXECUTE ON FUNCTION "+sig));
  assert.ok(postflight.includes("  ('"+sig+"')"));
  assert.ok(postflight.includes("has_function_privilege('authenticated','"+sig+"','EXECUTE')"));
  assert.ok(postflight.includes("has_function_privilege('anon','"+sig+"','EXECUTE')"));
 }
 assert.equal((postflight.match(/^  \('public\.[a-z_]+\([^']*\)'\)/gm)||[]).length,22);
 assert.ok(!originalGate.includes("actual_privileged_functions=22"));
 assert.ok(originalGate.includes("actual_privileged_functions=16"));
});

test("postrelease checker expects 22 exact definer functions, 9 authenticated allowances and 35 RLS policies",()=>{
 for(const marker of [
  "matched_privileged_functions=22","actual_privileged_functions=22",
  "authenticated_executable_functions=9","p.actual_privileged_functions<>22",
  "p.authenticated_executable_functions<>9","p.matched_views<>13",
  "p.anon_truncate_tables<>0","p.public_executable_functions<>0",
  "policy_count<>35","PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL",
  "DROP VIEW b74_review_permissions"
 ])assert.ok(postflight.includes(marker),marker);
 assert.match(postflight,/CREATE TEMP VIEW b74_review_permissions AS/);
 assert.match(postflight,/R[AISE]{4} EXCEPTION 'Build74 22-function permission postflight failed/);
 assert.match(postflight,/current_setting\('amf\.build74_rehearsal',true\)/);
 assert.doesNotMatch(postflight,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
});

test("fail closed when approved RPC source or sixteen-legacy-function anchors drift",()=>{
 const bad={...sources};
 bad[approvedRpcs[2][1]]=bad[approvedRpcs[2][1]].replace(
   "GRANT EXECUTE ON FUNCTION "+approvedRpcs[2][0],"-- missing signature");
 assert.throws(()=>buildPostflight(originalGate,bad),/RELEASE REHEARSAL REFUSED/);
 assert.throws(()=>buildPostflight(originalGate.replace("actual_privileged_functions=16",
   "actual_privileged_functions=15"),sources),/RELEASE REHEARSAL REFUSED/);
});

test("combined output preserves exactly one transaction and refuses missing original source anchors",()=>{
 const fixture="BEGIN;\n-- crm_import_candidates_atomic\n"+
 "zz_crm_billing_write_hold\nExpected 35 restricted RLS policies\nROLLBACK;\nSELECT 1;";
 const output=compose(fixture,postflight);
 assert.equal((output.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((output.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((output.match(/^COMMIT;$/gm)||[]).length,0);
 assert.ok(output.indexOf("b74_postflight")<output.indexOf("\nROLLBACK;\n"));
 assert.ok(output.indexOf("SET LOCAL amf.build74_rehearsal")<output.indexOf("CREATE TEMP VIEW"));
 assert.throws(()=>compose(fixture.replace("zz_crm_billing_write_hold","wrong"),postflight),/REFUSED/);
 assert.throws(()=>compose(fixture.replace("ROLLBACK;","COMMIT;"),postflight),/REFUSED/);
 assert.throws(()=>compose(fixture+"\nROLLBACK;\n",postflight),/REFUSED/);
 assert.equal(originalFixture,"/tmp/build54-release-review/full-release-rollback.integration.sql");
 assert.equal(combinedFixture,"/tmp/build54-release-review/build74-22-function-rollback.integration.sql");
});

test("source control never edits the guarded Build54 release package or imports hosted service keys",()=>{
 const code=read("security/build74/compose-postrelease-permission-check.mjs");
 assert.match(code,/originalFixture="\/tmp\/build54-release-review\/full-release-rollback.integration.sql"/);
 assert.match(code,/writeFileSync\(combinedFixture,combined\)/);
 assert.doesNotMatch(code,/writeFileSync\(originalFixture/);
 assert.doesNotMatch(code,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|PRODUCTION_CONNECTION_STRING/);
 assert.match(code,/^ \* Never creates deployable SQL/m);
});
