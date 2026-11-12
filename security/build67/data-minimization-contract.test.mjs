import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("extra-scope anonymous UAT uses only metadata HEAD and cannot fetch result bodies",()=>{
 const src=readFileSync("security/build66/hosted-anon-extra-scope.mjs","utf8");
 assert.match(src,/method:"HEAD"/);
 assert.match(src,/Prefer:"count=exact"/);
 assert.match(src,/content-range/);
 assert.doesNotMatch(src,/\bmethod:\s*"GET"/);
 assert.doesNotMatch(src,/\.json\s*\(/);
 assert.doesNotMatch(src,/\.text\s*\(/);
 assert.match(src,/response\?\.headers\?\.get\?\./);
 assert.match(src,/formal_hosted_acceptance:0/);
});
test("historical 135-case signed UAT downloads only 3 synthetic candidate ID projections",()=>{
 const src=readFileSync("security/build64/hosted-135-readonly.mjs","utf8");
 assert.match(src,/method:checkIds\?"GET":"HEAD"/);
 assert.match(src,/const checkIds=c\.table==="candidates"&&index<=2/);
 assert.match(src,/Prefer:"count=exact"/);
 assert.match(src,/u\.pathname==="\/rest\/v1\/candidates"&&u\.search==="\?select=id"/);
 assert.match(src,/if\(checkIds&&response\.status===200\)/);
 assert.match(src,/else if\(!checkIds&&\[200,206\]\.includes\(response\.status\)\)/);
 assert.match(src,/expectedHostedIds\[i\]/);
 assert.match(src,/formally_accepted_cases:0/);
 assert.match(src,/write_cases_executed:0,write_cases_deferred:5/);
});
test("no UAT tests call live production or place service-role keys in workflows",()=>{
 const workflows=[
  ".github/workflows/security-build34-review.yml",
  ".github/workflows/security-build65-fast.yml"
 ];
 for(const path of workflows){
  const src=readFileSync(path,"utf8");
  assert.doesNotMatch(src,/AMF_UAT_CASE_[0-9]{2}_PASSWORD:/);
  assert.doesNotMatch(src,/sb_secret_[A-Za-z0-9]{20}/);
  assert.doesNotMatch(src,/supabase\.co\/rest\/v1/);
  assert.match(src,/concurrency:/);
  assert.match(src,/cancel-in-progress: true/);
  assert.match(src,/github\.event_name/);
 }
 const scope=readFileSync("security/build66/hosted-anon-extra-scope.mjs","utf8");
 assert.match(scope,/dhlhlasnaapzckjyvffn\.supabase\.co/);
 assert.doesNotMatch(scope,/wusntntcqgtpgokggdzv/);
});
