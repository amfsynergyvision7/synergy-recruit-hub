import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join,dirname} from "node:path";
import {runLocalManifest} from "../lead-discovery/discover.mjs";
import {runLocalReview} from "../lead-discovery/review.mjs";
import {calculateSyntheticLeadKpis,runSyntheticKpiFixture,METRIC_DEFINITIONS} from "../lead-discovery/metrics.mjs";
const base=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(base,"manifest.synthetic.json");
const decisions=join(base,"review-decisions.synthetic.json");
const clone=x=>JSON.parse(JSON.stringify(x));
const fixture=async()=>({discovery:await runLocalManifest(manifest),review:await runLocalReview(manifest,decisions)});
test("Build165 full synthetic KPI CLI is repeatable and has no network, CRM or messages",()=>{
 const args=[join(base,"metrics.mjs"),manifest,decisions,"2026-11-15"];
 const a=JSON.parse(execFileSync(process.execPath,args,{encoding:"utf8"}));
 const b=JSON.parse(execFileSync(process.execPath,args,{encoding:"utf8"}));
 assert.deepEqual(a,b);
 assert.equal(a.mode,"SYNTHETIC_OFFLINE_AGGREGATES_ONLY");
 assert.deepEqual([a.network_requests,a.crm_writes,a.outbound_messages,a.actual_prospects],[0,0,0,0]);
 assert.equal(a.live_conversion_rate,null);
 assert.equal(a.actual_reply_rate,null);
 assert.equal(a.operational_baseline_accepted,false);
});
test("Build165 provenance quality, freshness, deduplication and review KPI denominators are reproducible",async()=>{
 const x=await runSyntheticKpiFixture(manifest,decisions,"2026-11-15");
 assert.deepEqual(x.totals,{snapshot_sources:2,extracted_entries:4,
  unique_fictional_businesses:3,duplicates_merged:1,unique_dated_proofs:4,
  pending_growth:0,pending_crm:1,rejected:1,approved_offline_preview:1});
 assert.deepEqual(x.measures.provenance_coverage,{numerator:3,denominator:3,value:1,denominator_empty:false});
 assert.deepEqual(x.measures.source_freshness_30d,{numerator:4,denominator:4,value:1,denominator_empty:false});
 assert.deepEqual(x.measures.deduplication_ratio,{numerator:1,denominator:4,value:0.25,denominator_empty:false});
 assert.deepEqual(x.measures.growth_review_completion,{numerator:3,denominator:3,value:1,denominator_empty:false});
 assert.deepEqual(x.measures.offline_handoff_preview_yield,{numerator:1,denominator:3,value:0.3333,denominator_empty:false});
 assert.equal(Object.keys(METRIC_DEFINITIONS).length,5);
});
test("Build165 production and future evidence cannot be smuggled into an offline KPI",async()=>{
 const a=await fixture();
 for(const label of ["discovery","review"]){
  const copy=clone(a);
  copy[label].network_requests=1;
  assert.throws(()=>calculateSyntheticLeadKpis(copy.discovery,copy.review,"2026-11-15"),/side-effect free/);
 }
 const future=clone(a);future.discovery.leads[0].evidence[0].captured_on="2026-11-16";
 assert.throws(()=>calculateSyntheticLeadKpis(future.discovery,future.review,"2026-11-15"),/future/);
});
test("Build165 duplicate proofs, different counts and untrusted reviewers fail closed",async()=>{
 const a=await fixture(),duplicates=clone(a);
 duplicates.discovery.leads[0].evidence.push(clone(duplicates.discovery.leads[0].evidence[0]));
 assert.throws(()=>calculateSyntheticLeadKpis(duplicates.discovery,duplicates.review,"2026-11-15"),/repeated source proof/);
 const wrong=clone(a);wrong.discovery.extracted_businesses++;
 assert.throws(()=>calculateSyntheticLeadKpis(wrong.discovery,wrong.review,"2026-11-15"),/denominators/);
 const forged=clone(a);forged.review.counts.pending_crm=2;
 assert.throws(()=>calculateSyntheticLeadKpis(forged.discovery,forged.review,"2026-11-15"),/review totals/);
});
test("Build165 audit event changes and unsolicited handoff writes fail closed",async()=>{
 const a=await fixture(),tamper=clone(a);
 tamper.review.audit_events[1].reviewer="attacker";
 assert.throws(()=>calculateSyntheticLeadKpis(tamper.discovery,tamper.review,"2026-11-15"),/invalid audited queue/);
 const writer=clone(a);writer.review.handoff.crm_writes=1;
 assert.throws(()=>calculateSyntheticLeadKpis(writer.discovery,writer.review,"2026-11-15"),/side-effect free/);
});
test("Build165 invalid dates, URLs and unsupported real-world source claims fail closed",async()=>{
 const a=await fixture();
 for(const date of ["2026-02-30","2026-11-2","today"])
  assert.throws(()=>calculateSyntheticLeadKpis(a.discovery,a.review,date),/cutoff/);
 const forged=clone(a);forged.discovery.leads[0].evidence[0].source_url="https://real-world.example.com/";
 assert.throws(()=>calculateSyntheticLeadKpis(forged.discovery,forged.review,"2026-11-15"),/proof/);
});
test("Build165 lead category 6/10 remains evidence-limited to LD01, LD03, LD04",()=>{
 const rubric=JSON.parse(readFileSync(join(base,"../release-progress/v1-rubric.json"),"utf8"));
 const snapshot=JSON.parse(readFileSync(join(base,"../release-progress/current.json"),"utf8"));
 const state=new Map(snapshot.statuses.map(s=>[s.id,s.complete]));
 const ld=rubric.milestones.filter(m=>m.group==="LD");
 assert.equal(ld.length,5);
 assert.equal(ld.filter(m=>state.get(m.id)).reduce((s,m)=>s+m.weight,0),6);
 assert.deepEqual(ld.filter(m=>state.get(m.id)).map(m=>m.id),["LD01","LD03","LD04"]);
 assert.equal(state.get("LD02"),false);
 assert.equal(state.get("LD05"),false);
});
test("Build165 industry and whitelist decisions and KPI threshold signatures are intentionally absent",()=>{
 const p=JSON.parse(readFileSync(join(base,"lead-policy.review.json"),"utf8"));
 const k=JSON.parse(readFileSync(join(base,"kpi-acceptance.review.json"),"utf8"));
 assert.equal(p.status,"REVIEW_DRAFT_NOT_APPROVED");
 assert.equal(p.live_lead_discovery_enabled,false);
 assert.deepEqual(p.required_decisions.target_industries,[]);
 assert.deepEqual(p.required_decisions.permitted_public_business_sources,[]);
 assert.equal(p.independent_approval.growth_owner,null);
 assert.equal(k.status,"REVIEW_DRAFT_NOT_APPROVED");
 assert.equal(k.live_kpi_acceptance_enabled,false);
 assert(k.measures.every(x=>x.approved_target===null));
 assert.equal(k.acceptance.growth_owner,null);
 assert.equal(k.acceptance.bi_owner,null);
});
test("Build165 category work package tracks one focus without claiming separate accepted LD milestones",()=>{
 const c=JSON.parse(readFileSync(join(base,"category-c-v1.json"),"utf8"));
 assert.equal(c.current_focus,true);
 assert.equal(c.formal_earned_points,6);
 assert.equal(c.formal_max_points,10);
 assert.deepEqual(c.formally_evidenced_milestones,["LD01","LD03","LD04"]);
 assert.equal(c.review_package.LD02.accepted,false);
 assert.equal(c.review_package.LD05.accepted,false);
 assert(c.reality_checks.no_real_prospects_collected);
 assert(c.reality_checks.security_issue19_untouched);
});
test("Build165 synthetic KPI implementation cannot use network, CRM or provider APIs",()=>{
 const s=readFileSync(join(base,"metrics.mjs"),"utf8");
 for(const forbidden of ["fetch(","https.request","http.request","supabase.from","createClient(","sendEmail(","nodemailer","writeFile(","appendFile("])
  assert(!s.includes(forbidden),forbidden);
 assert(s.includes("SYNTHETIC_OFFLINE_AGGREGATES_ONLY"));
});

test("Build165 category C report remains generated from fixed rubric and evidence ledger",async()=>{
 const {report}=await import("../lead-discovery/category-status.mjs");
 const r=JSON.parse(readFileSync(join(base,"../release-progress/v1-rubric.json"),"utf8"));
 const s=JSON.parse(readFileSync(join(base,"../release-progress/current.json"),"utf8"));
 const p=JSON.parse(readFileSync(join(base,"category-c-v1.json"),"utf8"));
 const actual=readFileSync(join(base,"CATEGORY-C-STATUS.md"),"utf8");
 assert.equal(actual,report(r,s,p));
 assert(actual.includes("6/10 (60%)"));
 assert(actual.includes("4/8 source/preparation tasks evidenced"));
 assert(actual.includes("LD02"));
 assert(actual.includes("LD05"));
});
test("Build165 artificially approved owner gates cannot inflate the lead category report",async()=>{
 const {report}=await import("../lead-discovery/category-status.mjs");
 const r=JSON.parse(readFileSync(join(base,"../release-progress/v1-rubric.json"),"utf8"));
 const s=JSON.parse(readFileSync(join(base,"../release-progress/current.json"),"utf8"));
 const p=JSON.parse(readFileSync(join(base,"category-c-v1.json"),"utf8"));
 p.review_package.LD02.accepted=true;
 assert.throws(()=>report(r,s,p),/Independent acceptance/);
});
test("Build165 category CI checks reproducible dashboard on every PR change",()=>{
 const ci=readFileSync(join(base,"../../.github/workflows/build165-category-c.yml"),"utf8");
 assert(ci.includes("node security/lead-discovery/category-status.mjs --check"));
 assert(ci.includes("security/build165-lead-category/contract.test.mjs"));
 assert(!ci.includes("workflow_dispatch:"));
});
