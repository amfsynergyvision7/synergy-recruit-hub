/**
 * Build 122 — local-only human review queue and NO-SEND CRM handoff preview.
 * All leads, website identifiers and sources must use reserved .example.invalid
 * synthetic names. No network calls, CRM client, file writes or email provider.
 * Recorded "reviewers" in committed fixtures are fictional and NOT signatures.
 */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLocalManifest, syntheticHttpsUrl, normalizeCapturedDate } from "./discover.mjs";

export const REVIEW_MODE = "SYNTHETIC_OFFLINE_REVIEW";
export const MAX_REVIEW_BYTES = 25_000;
const ALLOWED_LEAD = new Set([
  "company_name", "business_website", "location", "industry",
  "verified_hiring_signal", "research_status", "outreach_authorized",
  "crm_write_authorized", "evidence",
]);
const ALLOWED_PROOF = new Set(["source_url", "captured_on", "evidence_type"]);
const ALLOWED_REVIEW = new Set([
  "business_website", "reviewer_id", "reviewer_role", "decision",
  "reviewed_on", "evidence_url", "reason_code",
]);

function digest(item) { return createHash("sha256").update(item).digest("hex"); }
function exactKeys(item, allowed) {
  return item != null && typeof item==="object" && !Array.isArray(item) &&
    Object.keys(item).every(k=>allowed.has(k));
}
function businessText(text,max) {
  if(typeof text!=="string" || text.length>max) return false;
  const s=text.normalize("NFC").trim();
  if(!s || /[\u0000-\u001f\u007f<>{}]/u.test(s)) return false;
  // Never let synthetically invented people/phone/email/contact claims
  // piggyback on a company identity, location or industry.
  return !/[@]|\+?\d[\d() -]{7,}\d/u.test(s);
}
function canonicalWebsite(input) {
  const url=syntheticHttpsUrl(input);
  if(!url || url.pathname!=="/" || url.search || url.hash) return null;
  const hostname=url.hostname.replace(/^www\./,"");
  return "https://"+hostname;
}
function proofRecord(input) {
  if(!exactKeys(input,ALLOWED_PROOF)) return null;
  const src=syntheticHttpsUrl(input.source_url);
  const date=normalizeCapturedDate(input.captured_on);
  if(!src || !date || input.evidence_type!=="JSON-LD Organization") return null;
  return {source_url:src.href,captured_on:date,evidence_type:"JSON-LD Organization"};
}
function proofSort(a,b) {
  return a.source_url.localeCompare(b.source_url)||a.captured_on.localeCompare(b.captured_on);
}

export function buildReviewQueue(discovery) {
  if(discovery?.mode!=="SYNTHETIC_OFFLINE_ONLY" ||
     discovery.network_requests!==0 || discovery.crm_writes!==0 ||
     discovery.outbound_messages!==0 ||
     !Array.isArray(discovery.leads) || discovery.leads.length>100)
    throw new Error("Only bounded, side-effect-free synthetic discovery is reviewable");
  const index=new Map();
  for(const entry of discovery.leads) {
    if(!exactKeys(entry,ALLOWED_LEAD) ||
       !businessText(entry.company_name,120) ||
       !businessText(entry.industry,90) || !businessText(entry.location,90) ||
       entry.verified_hiring_signal!==false ||
       entry.outreach_authorized!==false || entry.crm_write_authorized!==false ||
       entry.research_status!=="synthetic_only_needs_human_review")
      throw new Error("Lead contains unsafe or unreviewable business data");
    const website=canonicalWebsite(entry.business_website);
    if(!website || !Array.isArray(entry.evidence) || !entry.evidence.length || entry.evidence.length>30)
      throw new Error("Lead provenance or business URL is invalid");
    const evidence=entry.evidence.map(proofRecord);
    if(evidence.some(x=>x===null)) throw new Error("Invalid synthetic lead provenance");
    const name=entry.company_name.normalize("NFC").trim();
    const city=entry.location.normalize("NFC").trim();
    const industry=entry.industry.normalize("NFC").trim();
    const prior=index.get(website);
    if(prior) {
      if(prior.company_name!==name || prior.location!==city || prior.industry!==industry)
        throw new Error("Conflicting duplicate company metadata requires manual source reconciliation");
      for(const proof of evidence)
        if(!prior.evidence.some(e=>e.source_url===proof.source_url && e.captured_on===proof.captured_on))
          prior.evidence.push(proof);
      continue;
    }
    index.set(website,{
      lead_id:"SYN-"+digest(website).slice(0,16),
      company_name:name,business_website:website,location:city,industry,
      evidence,review_status:"pending_growth_review",
      outreach_authorized:false,crm_write_authorized:false,
    });
  }
  const leads=[...index.values()].sort((a,b)=>a.business_website.localeCompare(b.business_website));
  for(const lead of leads)lead.evidence.sort(proofSort);
  return {
    mode:REVIEW_MODE, review_required:true, actions_executed:0,
    network_requests:0, crm_writes:0, outbound_messages:0,
    duplicate_businesses_merged:discovery.leads.length-leads.length,
    leads,
  };
}

function addAudit(records, event) {
  const prev_hash=records.length?records.at(-1).event_hash:"GENESIS";
  const body={sequence:records.length+1,prev_hash,...event};
  records.push({...body,event_hash:digest(JSON.stringify(body))});
}
export function verifyAuditChain(records) {
  if(!Array.isArray(records)||!records.length)return false;
  for(let i=0;i<records.length;i++){
    const current=records[i],{event_hash,...body}=current;
    if(current.sequence!==i+1 ||
       current.prev_hash!==(i?records[i-1].event_hash:"GENESIS") ||
       event_hash!==digest(JSON.stringify(body)))return false;
  }
  return true;
}
export function reviewAndPreviewHandoff(queue,manifest) {
  if(queue?.mode!==REVIEW_MODE || queue.crm_writes!==0 ||
     queue.network_requests!==0 || queue.outbound_messages!==0 ||
     !Array.isArray(queue.leads) || queue.leads.length>100)
    throw new Error("Only a safe synthetic review queue is supported");
  if(manifest?.mode!==REVIEW_MODE ||
     !Array.isArray(manifest.decisions) || manifest.decisions.length>200 ||
     typeof manifest.research_owner!=="string" ||
     !/^[a-z][a-z0-9-]{4,40}$/.test(manifest.research_owner))
    throw new Error("Invalid offline reviewer manifest");
  const queueIndex=new Map(queue.leads.map(x=>[x.business_website,x]));
  if(queueIndex.size!==queue.leads.length)throw new Error("Duplicate queue company");
  const states=new Map(queue.leads.map(x=>[x.business_website,{
    ...x,review_status:"pending_growth_review",review_records:[]
  }]));
  const audit=[];
  for(const row of queue.leads)
    addAudit(audit,{action:"QUEUED",lead_id:row.lead_id,reviewer:"system",reviewed_on:null});
  for(const decision of manifest.decisions) {
    if(!exactKeys(decision,ALLOWED_REVIEW) ||
       !["growth_reviewer","crm_reviewer"].includes(decision.reviewer_role) ||
       !["approve","reject"].includes(decision.decision) ||
       !/^[a-z][a-z0-9-]{4,40}$/.test(decision.reviewer_id) ||
       decision.reviewer_id===manifest.research_owner ||
       !normalizeCapturedDate(decision.reviewed_on))
      throw new Error("Review decision is malformed or self-reviewed");
    const company=canonicalWebsite(decision.business_website),row=states.get(company);
    if(!row)throw new Error("Reviewer referenced an unknown company");
    if(!row.evidence.some(e=>e.source_url===decision.evidence_url))
      throw new Error("Reviewer did not cite a matching archived source");
    if(decision.reviewed_on<row.evidence.reduce((a,e)=>a>e.captured_on?a:e.captured_on,"0000-00-00"))
      throw new Error("Review precedes the captured evidence");
    if(row.review_status==="rejected"||row.review_status==="approved_for_offline_handoff")
      throw new Error("Decision cannot override a final reviewed status");
    if(decision.reviewer_role==="growth_reviewer"){
      if(row.review_status!=="pending_growth_review")throw new Error("Duplicate growth review");
      if(decision.decision==="approve" && decision.reason_code!=="business_source_verified")
        throw new Error("Approval must cite a verified business source");
      if(decision.decision==="reject" &&
         !["out_of_scope","source_disputed","privacy_concern"].includes(decision.reason_code))
        throw new Error("Rejection requires a documented reason");
      row.review_status=decision.decision==="approve"?"pending_crm_review":"rejected";
    }else{
      if(row.review_status!=="pending_crm_review" ||
         decision.decision!=="approve" ||
         decision.reason_code!=="business_source_verified" ||
         row.review_records[0]?.reviewer_id===decision.reviewer_id)
        throw new Error("CRM approval requires a separate prior growth reviewer");
      row.review_status="approved_for_offline_handoff";
    }
    row.review_records.push({
      reviewer_id:decision.reviewer_id,reviewer_role:decision.reviewer_role,
      decision:decision.decision,reason_code:decision.reason_code,
      reviewed_on:decision.reviewed_on,evidence_url:decision.evidence_url,
    });
    addAudit(audit,{
      action:decision.decision==="reject"?"REJECTED":decision.reviewer_role==="growth_reviewer"?"GROWTH_APPROVED":"CRM_APPROVED",
      lead_id:row.lead_id,reviewer:decision.reviewer_id,
      reviewed_on:decision.reviewed_on,evidence_url:decision.evidence_url
    });
  }
  const reviewed=[...states.values()].sort((a,b)=>a.business_website.localeCompare(b.business_website));
  const accepted=reviewed.filter(x=>x.review_status==="approved_for_offline_handoff");
  const offline_handoff=accepted.map(row=>({
    format:"SYNTHETIC_NO_SEND_CRM_HANDOFF_V1",
    lead_id:row.lead_id,
    company_name:row.company_name,business_website:row.business_website,
    location:row.location,industry:row.industry,
    evidence:row.evidence,
    reviewer_ids:row.review_records.map(x=>x.reviewer_id),
    requires_separate_live_crm_approval:true,
    crm_write_authorized:false,outreach_authorized:false,
  }));
  for(const row of accepted)
    addAudit(audit,{action:"NO_SEND_HANDOFF_PREPARED",lead_id:row.lead_id,reviewer:"system",reviewed_on:null});
  if(!verifyAuditChain(audit))throw new Error("Audit chain verification failed");
  return {
    mode:REVIEW_MODE, network_requests:0, crm_writes:0,outbound_messages:0,
    review_queue:reviewed,
    counts:{
      pending_growth:reviewed.filter(x=>x.review_status==="pending_growth_review").length,
      pending_crm:reviewed.filter(x=>x.review_status==="pending_crm_review").length,
      rejected:reviewed.filter(x=>x.review_status==="rejected").length,
      approved_offline:accepted.length,
    },
    handoff:{mode:"SYNTHETIC_NO_SEND_CRM_HANDOFF_V1",destination:"NONE_OFFLINE_PREVIEW",
      output_only:true,crm_writes:0,outbound_messages:0,records:offline_handoff},
    audit_events:audit,audit_head:audit.at(-1)?.event_hash??null,
    real_contact_or_crm_authorization:false,
  };
}
export async function runLocalReview(discoveryManifest,decisionsPath=null){
  const discovery=await runLocalManifest(discoveryManifest),queue=buildReviewQueue(discovery);
  if(decisionsPath===null)return queue;
  const manifest=await realpath(resolve(discoveryManifest));
  const directory=await realpath(dirname(manifest));
  const decisionFile=await realpath(resolve(decisionsPath));
  const rel=relative(directory,decisionFile);
  if(!rel||rel===".."||rel.startsWith("../")||isAbsolute(rel)||!rel.endsWith(".json"))
    throw new Error("Review file must remain inside the approved synthetic fixture directory");
  const buffer=await readFile(decisionFile);
  if(buffer.byteLength>MAX_REVIEW_BYTES)throw new Error("Review manifest exceeds the limit");
  let decisions;
  try{decisions=JSON.parse(buffer.toString("utf8"));}
  catch{throw new Error("Invalid review manifest JSON");}
  return reviewAndPreviewHandoff(queue,decisions);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);
    if(args[0]==="queue"&&args.length===2)
      process.stdout.write(JSON.stringify(await runLocalReview(args[1]),null,2)+"\n");
    else if(args[0]==="handoff"&&args.length===3)
      process.stdout.write(JSON.stringify(await runLocalReview(args[1],args[2]),null,2)+"\n");
    else throw new Error("Usage: node review.mjs queue <manifest> OR handoff <manifest> <review-decisions>");
  }catch(err){
    process.stderr.write("Offline lead review refused input: "+err.message+"\n");
    process.exitCode=1;
  }
}
