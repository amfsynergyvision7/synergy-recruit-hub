import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  syntheticHttpsUrl, normalizeCapturedDate, discoverFromSnapshots,
  runLocalManifest
} from "../lead-discovery/discover.mjs";

const dir=dirname(fileURLToPath(import.meta.url)),base=join(dir,"../lead-discovery");
const manifestPath=join(base,"manifest.synthetic.json");
const source=readFileSync(join(base,"discover.mjs"),"utf8");
const html=(file)=>readFileSync(join(base,"fixtures",file),"utf8");

test("Build121 end-to-end CLI discovers three fictitious companies, merges one duplicate and prints provenance",()=>{
 const out=JSON.parse(execFileSync(process.execPath,[join(base,"discover.mjs"),manifestPath],{encoding:"utf8"}));
 assert.equal(out.source_count,2);
 assert.equal(out.extracted_businesses,4);
 assert.equal(out.duplicates_merged,1);
 assert.equal(out.lead_count,3);
 assert.deepEqual(out.leads.map(x=>x.business_website),[
 "https://acacia.example.invalid","https://bluebell.example.invalid",
 "https://cobalt.example.invalid"
 ]);
 assert.equal(out.leads[0].evidence.length,2);
 assert.deepEqual(out.leads[0].evidence.map(x=>x.captured_on),["2026-11-12","2026-11-13"]);
});

test("Build121 every discovered lead retains exact synthetic source URL and verified capture date",async()=>{
 const out=await runLocalManifest(manifestPath);
 for(const lead of out.leads){
  assert.equal(lead.research_status,"synthetic_only_needs_human_review");
  assert.equal(lead.outreach_authorized,false);
  assert.equal(lead.crm_write_authorized,false);
  assert.equal(lead.verified_hiring_signal,false);
  assert(lead.evidence.length>=1);
  for(const proof of lead.evidence){
   assert.equal(proof.evidence_type,"JSON-LD Organization");
   assert(syntheticHttpsUrl(proof.source_url));
   assert(normalizeCapturedDate(proof.captured_on));
  }
 }
 assert.equal(out.mode,"SYNTHETIC_OFFLINE_ONLY");
 assert.equal(out.network_requests,0);
 assert.equal(out.crm_writes,0);
 assert.equal(out.outbound_messages,0);
});

test("Build121 private email, phone, person entities and job claims never enter a lead record",async()=>{
 const output=JSON.stringify(await runLocalManifest(manifestPath));
 for(const hidden of ["person@private.example.invalid","private@person.example.invalid",
 "+91-0000000000","Do Not Export","Unverified job should not export"])
  assert(!output.includes(hidden),hidden);
 assert(!output.includes('"email"'));
 assert(!output.includes('"telephone"'));
 assert(!output.includes('"contact_person"'));
});

test("Build121 untrusted HTTP, local, real host, URL credentials, port and fragments are rejected",()=>{
 for(const url of ["http://directory.example.invalid","https://example.com",
 "https://localhost","https://127.0.0.1","https://[::1]",
 "https://admin:password@a.example.invalid","https://a.example.invalid:8443",
 "https://a.example.invalid/page#contact","javascript:alert(1)",
 "https://a.example.invalid.evil.com","https://a..example.invalid"]) assert.equal(syntheticHttpsUrl(url),null,url);
 assert(syntheticHttpsUrl("https://a.example.invalid/page"));
});

test("Build121 malformed dates and incomplete business data cannot generate evidence",()=>{
 for(const day of ["2026-02-30","2025-13-01","2026-11-2","tomorrow","2026-11-14T00:00:00Z"])
  assert.equal(normalizeCapturedDate(day),null,day);
 const report=discoverFromSnapshots([{source_url:"https://source.example.invalid",captured_on:"2026-11-14",
 html: "<script type='application/ld+json'>"+JSON.stringify({["@type"]:"Organization",name:"Missing public site",email:"hidden@example.invalid"})+"</script>"}]);
 assert.equal(report.lead_count,0);
 assert.equal(report.excluded_incomplete,1);
});

test("Build121 missing or real source URLs fail closed rather than probing the network",()=>{
 assert.throws(()=>discoverFromSnapshots([{source_url:"https://real-company.com",captured_on:"2026-11-14",html:""}]),/Unapproved/);
 assert.throws(()=>discoverFromSnapshots([{source_url:"https://source.example.invalid",captured_on:"2026-11-14",html:123}]),/invalid source snapshot/);
 assert.throws(()=>discoverFromSnapshots([]),/Invalid source snapshot count/);
});

test("Build121 HTML JSON-LD script is parsed as inert data and never executes",()=>{
 const injected="<script type='application/ld+json'>"+JSON.stringify({
 "@type":"Organization",name:"<img src=x onerror=alert(1)>",url:"https://safe.example.invalid",
 industry:"Consulting",address:{addressLocality:"Kolkata"}})+"</script>";
 const results=discoverFromSnapshots([{source_url:"https://source.example.invalid",captured_on:"2026-11-14",html:injected}]);
 assert.equal(results.lead_count,0);
 assert.equal(results.excluded_incomplete,1);
 assert.throws(()=>discoverFromSnapshots([{source_url:"https://source.example.invalid",captured_on:"2026-11-14",html:"<script type='application/ld+json'>{garbage}</script>"}]),/Invalid snapshot JSON-LD/);
});

test("Build121 unbounded snapshots and manifest structures are rejected without side effects",()=>{
 assert.throws(()=>discoverFromSnapshots([{source_url:"https://source.example.invalid",captured_on:"2026-11-14",html:"x".repeat(250001)}]),/Unapproved/);
 assert.throws(()=>discoverFromSnapshots(Array.from({length:13},()=>({source_url:"https://source.example.invalid",captured_on:"2026-11-14",html:""}))),/Invalid source snapshot count/);
});

test("Build121 fixed snapshot processing is byte-stable and does not silently vary with system time",async()=>{
 const a=await runLocalManifest(manifestPath),b=await runLocalManifest(manifestPath);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.deepEqual(a.leads.map(x=>x.company_name),[
 "Acacia Logistics (Synthetic)","Bluebell Engineering (Synthetic)","Cobalt Manufacturing (Synthetic)"
 ]);
});

test("Build121 discovery implementation cannot fetch, email or write CRM data",()=>{
 for(const forbidden of ["fetch(","https.request","http.request","smtp","supabase.from","sendEmail(","createClient(","writeFile("])
  assert(!source.includes(forbidden),forbidden);
 assert(source.includes("SYNTHETIC_OFFLINE_ONLY"));
 assert(source.includes('crm_write_authorized:false'));
 assert(source.includes('outreach_authorized:false'));
});
