import test from "node:test";
import assert from "node:assert/strict";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {discoverFromSnapshots,runLocalManifest} from "../lead-discovery/discover.mjs";
import {buildReviewQueue} from "../lead-discovery/review.mjs";
import {runSyntheticKpiFixture} from "../lead-discovery/metrics.mjs";
const home=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(home,"manifest.synthetic.json");
const review=join(home,"review-decisions.synthetic.json");
const company=(overrides={})=>({
 "@type":"Organization",name:"Fictional Beacon Manufacturing",
 url:"https://beacon.example.invalid",
 industry:"Manufacturing",
 address:{addressLocality:"Howrah"},...overrides
});
const source=(item,sourceNo=1)=>({
 source_url:sourceNo===1?"https://directory.example.invalid/logistics":
 "https://partners.example.invalid/listings",
 captured_on:sourceNo===1?"2026-11-12":"2026-11-13",
 html:'<script type="application/ld+json">'+JSON.stringify(item)+'</script>'
});
test("Build173 original three-fictional-company discovery and KPI baseline unchanged",async()=>{
 const r=await runLocalManifest(manifest);
 const k=await runSyntheticKpiFixture(manifest,review,"2026-11-15");
 assert.equal(r.lead_count,3);
 assert.equal(r.duplicates_merged,1);
 assert.equal(k.totals.unique_fictional_businesses,3);
 assert.equal(k.totals.unique_dated_proofs,4);
 assert.equal(k.measures.offline_handoff_preview_yield.numerator,1);
 assert.equal(k.actual_prospects,0);
 assert.equal(k.crm_writes+k.outbound_messages+k.network_requests,0);
});
test("Build173 valid duplicate company retains both dated source proofs",()=>{
 const a=discoverFromSnapshots([source(company()),source(company(),2)]);
 assert.equal(a.lead_count,1);
 assert.equal(a.duplicates_merged,1);
 assert.equal(a.leads[0].evidence.length,2);
 assert.equal(a.leads[0].company_name,"Fictional Beacon Manufacturing");
 assert.equal(buildReviewQueue(a).leads.length,1);
});
for(const [field,change] of [
 ["name",{"name":"Completely Different Company"}],
 ["industry",{"industry":"Other Sector"}],
 ["city",{"address":{addressLocality:"Different City"}}]
]){
 test("Build173 conflicting duplicate "+field+" fails before first-wins source output",()=>{
  const first=source(company()),second=source(company(change),2);
  for(const pair of [[first,second],[second,first]]){
   assert.throws(()=>discoverFromSnapshots(pair),
    /Conflicting duplicate company metadata requires manual source reconciliation/);
  }
 });
}
test("Build173 conflicted repeated company in one source snapshot is rejected",()=>{
 const s=source([company(),company({industry:"Contradictory Industry"})]);
 assert.throws(()=>discoverFromSnapshots([s]),/Conflicting duplicate company metadata/);
});
for(const [type,value,change] of [
 ["email in company name","Recruitment alice@private.example",{name:"Recruitment alice@private.example"}],
 ["phone in company name","Contact +91 9876543210",{name:"Contact +91 9876543210"}],
 ["email in location","team@private.example",{address:{addressLocality:"team@private.example"}}],
 ["phone in industry","Manufacturing +91 9876543210",{industry:"Manufacturing +91 9876543210"}],
 ["mailto contact","mailto:someone.private",{industry:"mailto:someone.private"}],
 ["telephone URI","tel:123-456-7890",{name:"tel:123-456-7890"}],
 ["template interpolation","{{personal_contact}}",{name:"{{personal_contact}}"}]
]){
 test("Build173 excludes "+type+" before discovery CLI can serialize it",()=>{
  const out=discoverFromSnapshots([source([company(change),company({
    name:"Safe Fictional Business",url:"https://safe-company.example.invalid"
  })])]);
  assert.equal(out.lead_count,1);
  assert.equal(out.excluded_incomplete,1);
  assert.equal(out.leads[0].company_name,"Safe Fictional Business");
  assert(!JSON.stringify(out).includes(value),"Sensitive business text leaked into discovery output");
 });
}
test("Build173 standalone validated review queue rejects mailto/tel synthetic company fields",async()=>{
 const d=await runLocalManifest(manifest);
 for(const text of ["mailto:private","tel:private"]){
  const fake=JSON.parse(JSON.stringify(d));
  fake.leads[0].company_name=text;
  assert.throws(()=>buildReviewQueue(fake),/unsafe or unreviewable business data/);
 }
});
test("Build173 adversarial inputs never authorize live CRM or outreach",()=>{
 const result=discoverFromSnapshots([source(company())]);
 assert.equal(result.network_requests,0);
 assert.equal(result.crm_writes,0);
 assert.equal(result.outbound_messages,0);
 assert.equal(result.leads[0].outreach_authorized,false);
 assert.equal(result.leads[0].crm_write_authorized,false);
});
