import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {runLocalManifest} from "../lead-discovery/discover.mjs";
import {runLocalReview} from "../lead-discovery/review.mjs";
import {calculateSyntheticLeadKpis} from "../lead-discovery/metrics.mjs";
import {examineCategoryCApprovals} from "../lead-discovery/approval-preflight.mjs";
const dir=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const read=x=>JSON.parse(readFileSync(join(dir,x),"utf8"));
const clone=x=>JSON.parse(JSON.stringify(x));
const fixture=async()=>({discovery:await runLocalManifest(join(dir,"manifest.synthetic.json")),
 review:await runLocalReview(join(dir,"manifest.synthetic.json"),join(dir,"review-decisions.synthetic.json"))});
function rehash(a){
 for(let i=0;i<a.length;i++){
  a[i].sequence=i+1;a[i].prev_hash=i?a[i-1].event_hash:"GENESIS";
  const {event_hash,...body}=a[i];
  a[i].event_hash=createHash("sha256").update(JSON.stringify(body)).digest("hex");
 }
}
test("Build166 original synthetic evidence remains valid after stronger identity checks",async()=>{
 const x=await fixture(),r=calculateSyntheticLeadKpis(x.discovery,x.review,"2026-11-15");
 assert.equal(r.totals.unique_fictional_businesses,3);
 assert.equal(r.totals.approved_offline_preview,1);
 assert.equal(r.actual_prospects,0);
});
test("Build166 forged review status and matching fabricated counts cannot increase approval yield",async()=>{
 const x=await fixture(),f=clone(x.review),row=f.review_queue.find(y=>y.review_status==="pending_crm_review");
 row.review_status="approved_for_offline_handoff";
 f.counts.pending_crm=0;f.counts.approved_offline=2;
 f.handoff.records.push({...clone(f.handoff.records[0]),lead_id:row.lead_id,
  business_website:row.business_website,company_name:row.company_name,
  location:row.location,industry:row.industry,evidence:row.evidence});
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,f,"2026-11-15"),/review status|handoff preparation/);
});
test("Build166 swapping reviewed handoff payload to different company is rejected",async()=>{
 const x=await fixture(),f=clone(x.review);
 f.handoff.records[0].business_website="https://bluebell.example.invalid";
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,f,"2026-11-15"),/handoff row differs/);
});
test("Build166 cloned lead identity and fake provenance rejected",async()=>{
 const x=await fixture(),f=clone(x.review);
 f.review_queue[0].lead_id="SYN-0000000000000000";
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,f,"2026-11-15"),/identities differ/);
 const p=clone(x.review);
 p.review_queue[0].evidence.push({...p.review_queue[0].evidence[0]});
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,p,"2026-11-15"),/identities differ/);
});
test("Build166 tampering with review details and recomputing hashes is still rejected",async()=>{
 const x=await fixture(),f=clone(x.review);
 f.review_queue[0].review_records[0].reason_code="unverified_revenue";
 rehash(f.audit_events);
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,f,"2026-11-15"),/review decision disagrees/);
});
test("Build166 unauthorized future review decision or invented audit event refused",async()=>{
 const x=await fixture(),future=clone(x.review);
 future.review_queue[0].review_records[0].reviewed_on="2026-11-16";
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,future,"2026-11-15"),/review decision disagrees/);
 const extra=clone(x.review);
 extra.audit_events.push({action:"AUTO_APPROVED",sequence:99,prev_hash:"GENESIS"});
 rehash(extra.audit_events);
 assert.throws(()=>calculateSyntheticLeadKpis(x.discovery,extra,"2026-11-15"),/unaccounted events/);
});
test("Build166 LD02 decision preflight lists exact unknown target and signature fields",()=>{
 const x=examineCategoryCApprovals(read("lead-policy.review.json"),read("kpi-acceptance.review.json"));
 assert.equal(x.LD02.review_fields_complete,false);
 assert(x.LD02.missing.includes("LD02 industry ICP"));
 assert(x.LD02.missing.includes("LD02 source whitelist"));
 assert(x.LD02.missing.some(z=>z.includes("Growth/Privacy signatures")));
 assert.equal(x.LD02.independently_accepted,false);
 assert.equal(x.release_authorized,false);
});
test("Build166 LD05 preflight never equates synthetic KPI tests to operational thresholds",()=>{
 const x=examineCategoryCApprovals(read("lead-policy.review.json"),read("kpi-acceptance.review.json"));
 assert.equal(x.LD05.review_fields_complete,false);
 assert(x.LD05.missing.some(z=>z.includes("real source observation")));
 assert(x.LD05.missing.some(z=>z.includes("Growth/BI signatures")));
 assert(x.LD05.missing.some(z=>z.includes("actual_meeting_conversion")));
 assert.equal(x.LD05.independently_accepted,false);
});
test("Build166 no policy activation, private business source or unsafe KPI threshold accepted",()=>{
 const p=read("lead-policy.review.json"),k=read("kpi-acceptance.review.json");
 const live=clone(p);live.live_lead_discovery_enabled=true;
 assert.throws(()=>examineCategoryCApprovals(live,k),/Live policy/);
 const write=clone(p);write.required_decisions.crm_writes_allowed=true;
 assert.throws(()=>examineCategoryCApprovals(write,k),/hard safety/);
 for(const url of ["http://example.com","https://127.0.0.1",
  "https://internal.example.invalid","https://user:pass@example.com"]){
  const fake=clone(p);fake.required_decisions.permitted_public_business_sources=[url];
  assert.throws(()=>examineCategoryCApprovals(fake,k),/Invalid or duplicate/);
 }
 const bad=clone(k);bad.measures[0].approved_target=2;
 assert.throws(()=>examineCategoryCApprovals(p,bad),/Invalid KPI ratio/);
});
test("Build166 no live APIs and all real owner signoffs remain inactive",()=>{
 const p=read("lead-policy.review.json"),k=read("kpi-acceptance.review.json");
 const a=readFileSync(join(dir,"approval-preflight.mjs"),"utf8");
 const m=readFileSync(join(dir,"metrics.mjs"),"utf8");
 for(const s of [a,m])for(const x of ["fetch(","http.request","https.request","createClient(","sendEmail(","writeFile(","appendFile("])
  assert(!s.includes(x),x);
 assert.equal(p.independent_approval.growth_owner,null);
 assert.equal(k.acceptance.growth_owner,null);
 assert.equal(k.acceptance.bi_owner,null);
 assert.equal(p.live_lead_discovery_enabled,false);
});

test("Build166 source scorecard and technical integrity ledger remain independently reconciled",async()=>{
 const {report}=await import("../lead-discovery/category-status.mjs");
 const pkg=read("category-c-v1.json");
 const rubric=read("../release-progress/v1-rubric.json");
 const snapshot=read("../release-progress/current.json");
 assert(pkg.latest_build>=166);
 assert(pkg.technical_integrity_controls.length>=5);
 assert(pkg.technical_integrity_controls.every(x=>x.status==="verified_offline"));
 const markdown=readFileSync(join(dir,"CATEGORY-C-STATUS.md"),"utf8");
 assert.equal(markdown,report(rubric,snapshot,pkg));
 assert.match(markdown,/[56]\/[56] synthetic engineering integrity controls verified offline/);
 assert.match(markdown,/4\/8 source\/preparation tasks evidenced/);
 assert.match(markdown,/Official acceptance: 6\/10/);
 assert.equal(pkg.review_package.LD02.accepted,false);
 assert.equal(pkg.review_package.LD05.accepted,false);
});
test("Build166 incomplete or mislabeled synthetic controls never count as verified",async()=>{
 const {report}=await import("../lead-discovery/category-status.mjs");
 const pkg=read("category-c-v1.json"),r=read("../release-progress/v1-rubric.json"),s=read("../release-progress/current.json");
 pkg.technical_integrity_controls[4].status="approved_live";
 assert.throws(()=>report(r,s,pkg),/engineering evidence ledger invalid/);
});
test("Build166 a fake meeting conversion metric cannot replace approved KPI definitions",()=>{
 const p=read("lead-policy.review.json"),k=read("kpi-acceptance.review.json");
 k.measures[5].id="unexpected_made_up_claim";
 assert.throws(()=>examineCategoryCApprovals(p,k),/Invalid or duplicate KPI identifier/);
});
