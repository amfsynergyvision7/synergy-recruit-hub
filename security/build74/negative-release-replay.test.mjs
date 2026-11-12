import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {composeNegative} from "./compose-negative-release-replays.mjs";
import {compose,buildPostflight,approvedRpcs} from "./compose-postrelease-permission-check.mjs";

const read=p=>readFileSync(p,"utf8");
const sources=Object.fromEntries(approvedRpcs.map(([,p])=>[p,read(p)]));
const postflight=buildPostflight(read("security/build73/48-object-release-preflight.readonly.sql"),sources);
const original="BEGIN;\n-- crm_import_candidates_atomic\nzz_crm_billing_write_hold\n"+
 "Expected 35 restricted RLS policies\nROLLBACK;\nSELECT 1;";
const positive=compose(original,postflight);
test("the two approved negative cases deliberately fail distinct security permissions",()=>{
 const cases=[
  "GRANT EXECUTE ON FUNCTION public.crm_import_candidates_atomic(uuid,uuid,jsonb) TO anon;",
  "GRANT TRUNCATE ON public.candidates TO anon;"
 ];
 for(const x of cases){
  const negative=composeNegative(positive,x);
  assert.ok(negative.includes(x+"\nSET LOCAL amf.build74_rehearsal"));
  assert.ok(negative.indexOf(x)<negative.indexOf("CREATE TEMP VIEW b74_review_permissions"));
  assert.equal((negative.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((negative.match(/^ROLLBACK;$/gm)||[]).length,1);
  assert.equal((negative.match(/^COMMIT;$/gm)||[]).length,0);
  assert.match(negative,/Build74 22-function permission postflight failed/);
  assert.ok(negative.endsWith("ROLLBACK;\nSELECT 1;"));
 }
});
test("tampering with positive rehearsal or injecting unapproved commands fails closed",()=>{
 assert.throws(()=>composeNegative(positive,"GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon;"),
  /NEGATIVE RELEASE CASE REFUSED/);
 assert.throws(()=>composeNegative(positive.replace("Build74 22-function permission postflight failed","not active"),
  "GRANT TRUNCATE ON public.candidates TO anon;"),/NEGATIVE RELEASE CASE REFUSED/);
 assert.throws(()=>composeNegative(positive.replace("ROLLBACK;","COMMIT;"),
  "GRANT TRUNCATE ON public.candidates TO anon;"),/NEGATIVE RELEASE CASE REFUSED/);
});
test("fault cases use only invented schema, no live Supabase host or deployable migration",()=>{
 const src=read("security/build74/compose-negative-release-replays.mjs");
 assert.doesNotMatch(src,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.doesNotMatch(src,/SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_SECRET/);
 assert.match(src,/DISPOSABLE_EXPECTED_FAILURE_ONLY/);
 assert.match(src,/negative-anonymous_candidate_rpc/);
});
