import test from "node:test";
import assert from "node:assert/strict";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {discoverFromSnapshots,runLocalManifest,LIMITS} from "../lead-discovery/discover.mjs";
import {buildReviewQueue,reviewAndPreviewHandoff,REVIEW_MODE} from "../lead-discovery/review.mjs";
import {calculateSyntheticLeadKpis} from "../lead-discovery/metrics.mjs";
const dir=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(dir,"manifest.synthetic.json");
const company=(url="https://acacia.example.invalid",name="Acacia Logistics (Synthetic)")=>({
 "@type":"Organization",name,url,industry:"Logistics",
 address:{addressLocality:"Kolkata"}
});
const html=(tag,item)=>"<"+tag+">"+JSON.stringify(item)+"</script>";
const src=(item,i=1,tag='script type="application/ld+json"')=>({
 source_url:i===1?"https://directory.example.invalid/logistics":"https://partners.example.invalid/listings",
 captured_on:i===1?"2026-11-12":"2026-11-13",
 html:html(tag,item)
});
test("Build174 original fictional manifest and provenance population unchanged",async()=>{
 const result=await runLocalManifest(manifest);
 assert.equal(result.lead_count,3);
 assert.equal(result.extracted_businesses,4);
 assert.equal(result.duplicates_merged,1);
 assert.equal(result.network_requests+result.crm_writes+result.outbound_messages,0);
});
test("Build174 www-only source emits canonical identity matching review queue",()=>{
 const d=discoverFromSnapshots([src(company("https://www.acacia.example.invalid/contact"))]);
 assert.equal(d.leads.length,1);
 assert.equal(d.leads[0].business_website,"https://acacia.example.invalid");
 const r=buildReviewQueue(d);
 assert.equal(r.leads[0].business_website,d.leads[0].business_website);
 assert.equal(r.leads[0].lead_id.startsWith("SYN-"),true);
});
test("Build174 www and bare duplicate source orders produce identical businesses, no fake source collision",()=>{
 const a=src(company("https://www.acacia.example.invalid/contact"),1);
 const b=src(company("https://acacia.example.invalid"),2);
 const x=discoverFromSnapshots([a,b]);
 const y=discoverFromSnapshots([b,a]);
 assert.deepEqual(x.leads,y.leads);
 assert.equal(x.lead_count,1);
 assert.equal(x.duplicates_merged,1);
 assert.equal(x.leads[0].evidence.length,2);
 const review=reviewAndPreviewHandoff(buildReviewQueue(x),{
   mode:REVIEW_MODE,research_owner:"researcher-example",decisions:[]
 });
 const kpis=calculateSyntheticLeadKpis(x,review,"2026-11-15");
 assert.equal(kpis.totals.unique_fictional_businesses,1);
 assert.equal(kpis.totals.unique_dated_proofs,2);
 assert.equal(kpis.crm_writes+kpis.outbound_messages+kpis.network_requests,0);
});
test("Build174 an actual script with actual quoted JSON-LD type still extracts",()=>{
 for(const tag of ['script type="application/ld+json"',"script type='application/ld+json'",
  "script type=application/ld+json","script data-research=fictional type = 'application/ld+json'"]){
  const d=discoverFromSnapshots([src(company(),1,tag)]);
  assert.equal(d.lead_count,1,tag);
 }
});
for(const tag of [
 'script data-type="application/ld+json"',
 'script prototype="application/ld+json"',
 'script x:type="application/ld+json"',
 'script not-type="application/ld+json"',
 'script-data type="application/ld+json"'
]){
 test("Build174 spoofed structured-data tag or attribute is not business proof: "+tag,()=>{
  const d=discoverFromSnapshots([src(company(),1,tag)]);
  assert.equal(d.lead_count,0);
  assert.equal(d.extracted_businesses,0);
  assert.equal(d.excluded_incomplete,0);
 });
}
test("Build174 oversized nonbusiness JSON-LD arrays fail bounded traversal before stack spread",()=>{
 const oversized=Array.from({length:LIMITS.jsonLdNodesPerSource+1},()=>null);
 assert.throws(()=>discoverFromSnapshots([src(oversized)]),/Too many structured-data nodes/);
});
test("Build174 many nested nonbusiness graph nodes cannot bypass traversal limit",()=>{
 const many=Array.from({length:LIMITS.jsonLdNodesPerSource},()=>({"@type":"Person","name":"Synthetic"}));
 assert.throws(()=>discoverFromSnapshots([src({"@graph":many})]),/Too many structured-data nodes/);
});
test("Build174 bounded nonbusiness graph remains inert, no contacts or entity exports",()=>{
 const graph=Array.from({length:50},(_,i)=>({"@type":"Person",name:"Private Synthetic "+i,email:"fiction@example.invalid"}));
 const d=discoverFromSnapshots([src({"@graph":graph})]);
 assert.equal(d.lead_count,0);
 assert(!JSON.stringify(d).includes("fiction@example.invalid"));
});
test("Build174 graph with a proper Organization is still handled deterministically",()=>{
 const d=discoverFromSnapshots([src({"@graph":[{"@type":"Person",name:"Private Synthetic"},company()]})]);
 assert.equal(d.lead_count,1);
 assert.equal(d.leads[0].company_name,"Acacia Logistics (Synthetic)");
});
