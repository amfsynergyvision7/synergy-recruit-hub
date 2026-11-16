import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";

const views=["available_recruiters","candidates_for_assignment",
 "recruiter_performance","recruiter_performance_with_names",
 "recruiter_stats","recruiter_summary",
 "vw_billing_filters","vw_candidate_filters","vw_client_filters",
 "vw_interview_filters","vw_job_filters","vw_offer_filters","vw_submission_filters"];

const files=[];
function walk(dir){
 for(const e of readdirSync(dir,{withFileTypes:true})){
  if(e.name==="node_modules"||e.name==="ui")continue;
  const p=join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(/\.(?:ts|tsx|js|mjs)$/.test(e.name))files.push(p);
 }
}
walk("src");

test("all 13 live-source views remain source-covered in Build49",()=>{
 const baseline=readFileSync("security/build49/67-policy-plus-account-rpcs-review-only.sql","utf8");
 assert.match(baseline,/ALTER VIEW public\.%I SET \(security_invoker=true\)/);
 for(const view of views)assert.ok(baseline.includes("'"+view+"'"),
  "Missing source-protected view "+view);
 assert.equal(views.length,13);
});
test("browser literal view reads cannot silently turn into direct table DML",()=>{
 const findings=[];
 let calls=0;
 for(const file of files){
  const code=readFileSync(file,"utf8");
  for(const view of views){
   for(const quote of ["'",'"']){
    const needle=".from("+quote+view+quote+")";
    let index=code.indexOf(needle);
    while(index>=0){
      calls++;
      const tail=code.slice(index,index+500).split(";")[0];
      if(/\.(?:insert|update|upsert|delete)\s*\(/.test(tail))
       findings.push(file+"::"+view);
      index=code.indexOf(needle,index+needle.length);
    }
   }
  }
 }
 assert.ok(files.length>30,"Unexpected browser source inventory shrinkage");
 assert.deepEqual(findings,[],"Direct protected-view writes found");
});
