import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {runLocalManifest} from "../lead-discovery/discover.mjs";
import {runLocalReview} from "../lead-discovery/review.mjs";
import {reconcileCuratedSyntheticReference,runCuratedSyntheticReference} from "../lead-discovery/reconcile.mjs";
import {report} from "../lead-discovery/category-status.mjs";
const base=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(base,"manifest.synthetic.json"),decisions=join(base,"review-decisions.synthetic.json");
const read=x=>JSON.parse(readFileSync(join(base,x),"utf8"));
const fixture=async()=>({discovery:await runLocalManifest(manifest),review:await runLocalReview(manifest,decisions),oracle:read("curated-reference.synthetic.json")});
const clone=x=>JSON.parse(JSON.stringify(x));
test("Build167 separate manually curated reference matches original synthetic 3-business record",async()=>{
 const r=await runCuratedSyntheticReference(manifest,decisions);
 assert.equal(r.mode,"SYNTHETIC_MANUAL_REFERENCE_RECONCILIATION");
 assert.equal(r.verdict,"PASS_SYNTHETIC_ONLY");
 assert.equal(r.mismatch_count,0);
 assert.equal(r.reference_business_count,3);
 assert.equal(r.checks_compared,30);
 assert.equal(r.owner_signed,false);
 assert.equal(r.real_business_observations,0);
 assert.equal(r.independent_operational_acceptance,false);
});
test("Build167 CLI prints only synthetic counts and does not contact anyone",()=>{
 const output=JSON.parse(execFileSync(process.execPath,[
  join(base,"reconcile.mjs"),manifest,decisions],{encoding:"utf8"}));
 assert.equal(output.outbound_messages+output.crm_writes,0);
 assert.equal(output.verdict,"PASS_SYNTHETIC_ONLY");
 assert.equal(output.live_approved,false);
 assert(!JSON.stringify(output).includes("person@private"));
});
test("Build167 silently incorrect source capture day is flagged by independent reference",async()=>{
 const x=await fixture(),bad=clone(x.discovery);
 bad.leads[0].evidence[0].captured_on="2026-11-11";
 assert.throws(()=>reconcileCuratedSyntheticReference(bad,x.review,x.oracle),
 /review identities differ from source-reconciled businesses/);
});
test("Build167 industry or business name changed without explanation is independently reported",async()=>{
 const x=await fixture(),truth=clone(x.oracle);
 truth.businesses[1].industry="Different Sector";
 const r=reconcileCuratedSyntheticReference(x.discovery,x.review,truth);
 assert.equal(r.mismatch_count,1);
 assert.match(r.mismatches[0].code,/industry/);
});
test("Build167 curated review outcome mismatch does not pass even if computed KPI totals match",async()=>{
 const x=await fixture(),truth=clone(x.oracle);
 truth.businesses[2].review_status="approved_for_offline_handoff";
 const r=reconcileCuratedSyntheticReference(x.discovery,x.review,truth);
 assert.equal(r.mismatch_count,1);
 assert.match(r.mismatches[0].code,/review/);
});
test("Build167 altered expected aggregate denominator fails reconciliation",async()=>{
 const x=await fixture(),truth=clone(x.oracle);
 truth.expected_measures.deduplication_ratio.denominator=5;
 const r=reconcileCuratedSyntheticReference(x.discovery,x.review,truth);
 assert.equal(r.verdict,"FAIL_SYNTHETIC_MISMATCH");
 assert(r.mismatches.some(x=>x.code==="KPI_deduplication_ratio"));
});
test("Build167 fake operational signature or live source cannot enter curated reference",async()=>{
 const x=await fixture();
 const sign=clone(x.oracle);sign.reviewer_signoff=true;
 assert.throws(()=>reconcileCuratedSyntheticReference(x.discovery,x.review,sign),/not a bounded, unsigned/);
 const live=clone(x.oracle);live.businesses[0].website="https://real-business.com";
 assert.throws(()=>reconcileCuratedSyntheticReference(x.discovery,x.review,live),/invalid business/);
});
test("Build167 fabricated extra fictional business is refused, never counted as real prospect",async()=>{
 const x=await fixture(),truth=clone(x.oracle);
 truth.businesses.push({...truth.businesses[0],website:"https://brand-new.example.invalid"});
 truth.totals.unique_fictional_businesses=4;
 const r=reconcileCuratedSyntheticReference(x.discovery,x.review,truth);
 assert.equal(r.verdict,"FAIL_SYNTHETIC_MISMATCH");
 assert(r.mismatches.some(x=>x.code==="BUSINESS_POPULATION"));
});
test("Build167 immutable frozen scorecard titles render accurately instead of undefined",()=>{
 const rubric=read("../release-progress/v1-rubric.json");
 const snapshot=read("../release-progress/current.json"),pkg=read("category-c-v1.json");
 const md=report(rubric,snapshot,pkg);
 for(const m of rubric.milestones.filter(m=>m.group==="LD"))assert(md.includes(m.title),m.id);
 assert(!md.includes("| undefined |"));
 assert.equal(readFileSync(join(base,"CATEGORY-C-STATUS.md"),"utf8"),md);
});
test("Build167 no external effects in source and CI runs independent reference check",()=>{
 const wf=readFileSync(join(base,"../../.github/workflows/build165-category-c.yml"),"utf8");
 assert(wf.includes("security/build167-lead-category/contract.test.mjs"));
 assert(wf.includes("node security/lead-discovery/reconcile.mjs"));
 assert(!wf.includes("workflow_dispatch:"));
 for(const file of ["reconcile.mjs","metrics.mjs"]){
  const code=readFileSync(join(base,file),"utf8");
  for(const bad of ["fetch(","https.request","http.request","createClient(","sendEmail(","writeFile(","appendFile("])
   assert(!code.includes(bad),file+": "+bad);
 }
});
