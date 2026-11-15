import test from "node:test";
import assert from "node:assert/strict";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {discoverFromSnapshots,runLocalManifest} from "../lead-discovery/discover.mjs";
import {buildReviewQueue} from "../lead-discovery/review.mjs";
const root=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const org={
 "@type":"Organization",name:"Fictional Acacia Organization",
 url:"https://acacia.example.invalid",industry:"Logistics",
 address:{addressLocality:"Kolkata"}
};
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=(attrs,items=org)=>discoverFromSnapshots([{
 source_url:"https://directory.example.invalid/logistics",captured_on:"2026-11-12",
 html:"<script "+attrs+">"+JSON.stringify(items)+"</script>"
}]);
test("Build175 frozen two-source fictitious baseline remains accepted without external effects",async()=>{
 const r=await runLocalManifest(join(root,"manifest.synthetic.json"));
 assert.equal(r.mode,"SYNTHETIC_OFFLINE_ONLY");
 assert.equal(r.lead_count,3);
 assert.equal(r.extracted_businesses,4);
 assert.equal(r.duplicates_merged,1);
 assert.equal(r.network_requests+r.crm_writes+r.outbound_messages,0);
 assert.equal(buildReviewQueue(r).leads.length,3);
});
test("Build175 real, unique, case-insensitive type metadata still yields a fictional business",()=>{
 for(const attrs of [
  'type="application/ld+json"',
  "TYPE='APPLICATION/LD+JSON'",
  "data-note='type=application/ld+json is quoted and inert' type=application/ld+json",
  'type = "application/ld+json" data-note="safe metadata"'
 ]){
  const r=sample(attrs);
  assert.equal(r.lead_count,1,attrs);
  assert.equal(r.leads[0].business_website,"https://acacia.example.invalid");
 }
});
for(const attrs of [
 'type="application/ld+json" type="text/javascript"',
 'type="text/plain" type="application/ld+json"',
 'type=application/ld+json TYPE=application/ld+json',
 'data-note="an inert type=application/ld+json" type="text/plain"',
 'data-note="a quoted type=application/ld+json with no real type"',
 'src="https://directory.example.invalid/business.json" type="application/ld+json"',
 'type="application/ld+json" onload="syntheticInertExample()"',
 'type="application/ld+json" malformed-boolean-attribute'
 ]){
 test("Build175 rejects ambiguous or forged inline JSON-LD evidence: "+attrs,()=>{
  const report=sample(attrs);
  assert.equal(report.extracted_businesses,0);
  assert.equal(report.lead_count,0);
  assert.equal(report.network_requests,0);
 });
}
test("Build175 dual Person + Organization schema is never a company record",()=>{
 for(const list of [
  ["Organization","Person"],
  ["Person","LocalBusiness"],
  ["Corporation","Person"]
 ]){
  const report=sample('type="application/ld+json"',{...clone(org),"@type":list});
  assert.equal(report.lead_count,0,list.join(","));
  assert(!JSON.stringify(report).includes("Fictional Acacia Organization"));
 }
});
test("Build175 mixed-type person cannot disguise itself beside legitimate organization",()=>{
 const mixed={...clone(org),"@type":["Person","Organization"],name:"Person-Like Record",
  email:"secret.synthetic@example.invalid"};
 const legitimate={...clone(org),url:"https://legit-business.example.invalid",
  name:"Legitimate Fictional Company"};
 const report=sample('type="application/ld+json"',{"@graph":[mixed,legitimate]});
 assert.equal(report.lead_count,1);
 assert.equal(report.leads[0].company_name,"Legitimate Fictional Company");
 assert(!JSON.stringify(report).includes("Person-Like Record"));
 assert(!JSON.stringify(report).includes("secret.synthetic@example.invalid"));
});
test("Build175 all outputs remain offline, no outbound/CRM capability introduced",()=>{
 const r=sample('type="application/ld+json"');
 assert.equal(r.human_review_required,true);
 assert.equal(r.network_requests,0);
 assert.equal(r.crm_writes,0);
 assert.equal(r.outbound_messages,0);
 assert.equal(r.leads[0].crm_write_authorized,false);
 assert.equal(r.leads[0].outreach_authorized,false);
});
