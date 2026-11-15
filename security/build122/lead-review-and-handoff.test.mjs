import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runLocalManifest } from "../lead-discovery/discover.mjs";
import {
 buildReviewQueue, reviewAndPreviewHandoff, verifyAuditChain,
 runLocalReview, REVIEW_MODE
} from "../lead-discovery/review.mjs";

const base=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(base,"manifest.synthetic.json");
const decisionsFile=join(base,"review-decisions.synthetic.json");
const decisions=JSON.parse(readFileSync(decisionsFile,"utf8"));
const clone=x=>structuredClone(x);
const produced=()=>runLocalManifest(manifest).then(buildReviewQueue);

test("Build122 queue has three synthetic businesses, strict provenance and no PII",async()=>{
 const q=await produced();
 assert.equal(q.mode,REVIEW_MODE);
 assert.equal(q.leads.length,3);
 assert.equal(q.review_required,true);
 assert.equal(q.network_requests+q.crm_writes+q.outbound_messages,0);
 assert.equal(q.actions_executed,0);
 assert(q.leads.every(x=>x.review_status==="pending_growth_review"));
 assert(q.leads.every(x=>x.lead_id.startsWith("SYN-")));
 assert(q.leads.every(x=>x.evidence.length>=1));
 for(const forbidden of ["email","phone","telephone","contact_person","person@private"])
  assert(!JSON.stringify(q).includes(forbidden));
});

test("Build122 CLI outputs one approved offline handoff, one rejection and one pending second approval",()=>{
 const script=join(base,"review.mjs");
 const queue=JSON.parse(execFileSync(process.execPath,[script,"queue",manifest],{encoding:"utf8"}));
 const result=JSON.parse(execFileSync(process.execPath,[script,"handoff",manifest,decisionsFile],{encoding:"utf8"}));
 assert.equal(queue.leads.length,3);
 assert.deepEqual(result.counts,{pending_growth:0,pending_crm:1,rejected:1,approved_offline:1});
 assert.equal(result.handoff.records.length,1);
 assert.equal(result.handoff.records[0].company_name,"Acacia Logistics (Synthetic)");
 assert.equal(result.handoff.destination,"NONE_OFFLINE_PREVIEW");
 assert.equal(result.handoff.output_only,true);
 assert.equal(result.crm_writes+result.outbound_messages+result.network_requests,0);
 assert.equal(result.real_contact_or_crm_authorization,false);
});

test("Build122 separate growth and CRM reviewers required before handoff, with no-send flags",async()=>{
 const q=await produced(),withoutCrm={...decisions,decisions:decisions.decisions.filter(x=>x.reviewer_role!=="crm_reviewer")};
 assert.equal(reviewAndPreviewHandoff(q,withoutCrm).handoff.records.length,0);
 const approved=reviewAndPreviewHandoff(q,decisions);
 assert.equal(approved.handoff.records.length,1);
 assert.deepEqual(approved.handoff.records[0].reviewer_ids,["synthetic-growth","synthetic-crm"]);
 assert.equal(approved.handoff.records[0].requires_separate_live_crm_approval,true);
 assert.equal(approved.handoff.records[0].crm_write_authorized,false);
 assert.equal(approved.handoff.records[0].outreach_authorized,false);
});

test("Build122 rejected company excluded and rejection appears in audit",async()=>{
 const r=reviewAndPreviewHandoff(await produced(),decisions);
 const row=r.review_queue.find(x=>x.company_name.includes("Bluebell"));
 assert.equal(row.review_status,"rejected");
 assert.equal(row.review_records[0].reason_code,"out_of_scope");
 assert(!r.handoff.records.some(x=>x.company_name.includes("Bluebell")));
 assert(r.audit_events.some(x=>x.action==="REJECTED"&&x.lead_id===row.lead_id));
});

test("Build122 CRM reviewer cannot skip growth review or be the same actor",async()=>{
 const q=await produced(),m=clone(decisions);
 assert.throws(()=>reviewAndPreviewHandoff(q,{...m,decisions:[m.decisions[1]]}),/separate prior growth reviewer/);
 m.decisions[1].reviewer_id="synthetic-growth";
 assert.throws(()=>reviewAndPreviewHandoff(q,m),/separate prior growth reviewer/);
});

test("Build122 duplicate growth review fails rather than overwriting decision",async()=>{
 const q=await produced(),m=clone(decisions);
 m.decisions.splice(1,0,clone(m.decisions[0]));
 assert.throws(()=>reviewAndPreviewHandoff(q,m),/Duplicate growth review/);
});

test("Build122 research owner cannot self-review and unknown role is blocked",async()=>{
 const q=await produced(),m=clone(decisions);
 m.decisions[0].reviewer_id=m.research_owner;
 assert.throws(()=>reviewAndPreviewHandoff(q,m),/self-reviewed/);
 const role=clone(decisions);role.decisions[0].reviewer_role="admin";
 assert.throws(()=>reviewAndPreviewHandoff(q,role),/malformed/);
});

test("Build122 reviewer cites exact archived source and date no earlier than capture",async()=>{
 const q=await produced(),bad=clone(decisions);
 bad.decisions[0].evidence_url="https://unknown.example.invalid/forged";
 assert.throws(()=>reviewAndPreviewHandoff(q,bad),/matching archived source/);
 const date=clone(decisions);date.decisions[0].reviewed_on="2026-01-01";
 assert.throws(()=>reviewAndPreviewHandoff(q,date),/precedes the captured evidence/);
});

test("Build122 only documented approval reasons allowed and rejection is final",async()=>{
 const q=await produced(),bad=clone(decisions);
 bad.decisions[0].reason_code="automatically_validated";
 assert.throws(()=>reviewAndPreviewHandoff(q,bad),/verified business source/);
 const reject=clone(decisions);
 reject.decisions.push({...reject.decisions[0],business_website:"https://bluebell.example.invalid"});
 assert.throws(()=>reviewAndPreviewHandoff(q,reject),/override a final reviewed status/);
});

test("Build122 fabricated company, personal reviewer metadata and unknown manifest fields rejected",async()=>{
 const q=await produced(),x=clone(decisions);
 x.decisions[0].business_website="https://attacker.example.invalid";
 assert.throws(()=>reviewAndPreviewHandoff(q,x),/unknown company/);
 const y=clone(decisions);y.decisions[0].email="private@person.invalid";
 assert.throws(()=>reviewAndPreviewHandoff(q,y),/malformed/);
 const z=clone(decisions);z.service_role_key="secret";
 assert.throws(()=>reviewAndPreviewHandoff(q,z),/Invalid offline reviewer manifest/);
});

test("Build122 direct review API refuses forged PII-bearing queue fields",async()=>{
 const q=await produced(),x=clone(q);
 x.leads[0].email="secret@example.invalid";
 assert.throws(()=>reviewAndPreviewHandoff(x,decisions),/private fields/);
 const url=clone(q);url.leads[0].business_website="https://real-world-company.com";
 assert.throws(()=>reviewAndPreviewHandoff(url,decisions),/forged identity or provenance/);
 const id=clone(q);id.leads[0].lead_id="SYN-spoofed";
 assert.throws(()=>reviewAndPreviewHandoff(id,decisions),/forged identity or provenance/);
});

test("Build122 audit chain is tamper-evident, includes review and handoff actions",async()=>{
 const r=reviewAndPreviewHandoff(await produced(),decisions);
 assert(verifyAuditChain(r.audit_events));
 assert.equal(r.audit_head,r.audit_events.at(-1).event_hash);
 assert(r.audit_events.some(x=>x.action==="NO_SEND_HANDOFF_PREPARED"));
 const tamper=clone(r.audit_events);tamper[2].reviewer="attacker";
 assert.equal(verifyAuditChain(tamper),false);
 const skip=clone(r.audit_events);skip.splice(1,1);
 assert.equal(verifyAuditChain(skip),false);
});

test("Build122 no contacts or unverified hiring/fee claims enter handoff payload or audit",async()=>{
 const r=reviewAndPreviewHandoff(await produced(),decisions),json=JSON.stringify(r);
 for(const secret of ["person@private","telephone","contact_person","email","mobile","phone_number","service_role_key"])
  assert(!json.includes(secret),secret);
 for(const lead of r.handoff.records){
  assert(lead.evidence.every(x=>x.source_url.includes(".example.invalid")));
  assert.equal(lead.outreach_authorized,false);
  assert.equal(lead.crm_write_authorized,false);
 }
});

test("Build122 duplicate same-company source rows merge into one review identity",async()=>{
 const d=await runLocalManifest(manifest);
 d.leads.push(clone(d.leads[0]));
 const q=buildReviewQueue(d);
 assert.equal(q.leads.length,3);
 assert.equal(q.duplicate_businesses_merged,1);
 assert.equal(reviewAndPreviewHandoff(q,decisions).handoff.records.length,1);
});

test("Build122 conflicting duplicate company name fails closed for manual reconciliation",async()=>{
 const d=await runLocalManifest(manifest),duplicate=clone(d.leads[0]);
 duplicate.company_name="Unapproved Contradictory Business";
 d.leads.push(duplicate);
 assert.throws(()=>buildReviewQueue(d),/Conflicting duplicate company metadata/);
});

test("Build122 fake hiring signal, invalid provenance and preexisting side effects fail closed",async()=>{
 const d=await runLocalManifest(manifest);
 d.leads[0].verified_hiring_signal=true;
 assert.throws(()=>buildReviewQueue(d),/unsafe or unreviewable/);
 const bad=await runLocalManifest(manifest);
 bad.leads[0].evidence[0].source_url="http://localhost/record";
 assert.throws(()=>buildReviewQueue(bad),/Invalid synthetic lead provenance/);
 const effect=await runLocalManifest(manifest);
 effect.crm_writes=1;
 assert.throws(()=>buildReviewQueue(effect),/side-effect-free/);
});

test("Build122 review chain and handoff output are deterministic on identical fixtures",async()=>{
 const a=await runLocalReview(manifest,decisionsFile);
 const b=await runLocalReview(manifest,decisionsFile);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.equal(a.handoff.records.length,1);
});

test("Build122 empty synthetic review queue has valid audit and no implicit approvals",()=>{
 const q=buildReviewQueue({mode:"SYNTHETIC_OFFLINE_ONLY",network_requests:0,crm_writes:0,outbound_messages:0,leads:[]});
 const r=reviewAndPreviewHandoff(q,{mode:REVIEW_MODE,research_owner:"synthetic-researcher",decisions:[]});
 assert.equal(r.handoff.records.length,0);
 assert(verifyAuditChain(r.audit_events));
 assert.equal(r.counts.pending_growth,0);
});

test("Build122 review module is offline-only and cannot send messages or mutate CRM",()=>{
 const s=readFileSync(join(base,"review.mjs"),"utf8");
 for(const forbidden of ["fetch(","https.request","http.request","smtp","sendEmail(",
   "supabase.from","createClient(","writeFile(","appendFile(","fs.write"])
   assert(!s.includes(forbidden),forbidden);
 assert(s.includes("NONE_OFFLINE_PREVIEW"));
 assert(s.includes("outbound_messages:0"));
 assert(s.includes("crm_writes:0"));
});
