/**
 * Build165 Category C: purely offline synthetic lead discovery measurements.
 * Every output is aggregate-only, never an operational lead or approval.
 */
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {runLocalManifest,normalizeCapturedDate,syntheticHttpsUrl} from "./discover.mjs";
import {runLocalReview,verifyAuditChain,REVIEW_MODE} from "./review.mjs";

export const METRIC_DEFINITIONS=Object.freeze({
 provenance_coverage:"synthetic businesses with archived dated HTTPS evidence / unique synthetic businesses",
 source_freshness_30d:"dated evidence entries captured within previous 30 days / all dated evidence entries",
 deduplication_ratio:"duplicates merged / extracted fictional business entries",
 growth_review_completion:"fictional businesses with one growth reviewer decision / unique fictional businesses",
 offline_handoff_preview_yield:"approved fictional offline CRM handoffs / unique fictional businesses"
});
const rate=(num,den)=>({
 numerator:num,denominator:den,value:den===0?null:Math.round((num/den)*10000)/10000,
 denominator_empty:den===0
});
const fail=m=>{throw new Error("Synthetic KPI evidence rejected: "+m);};

export function calculateSyntheticLeadKpis(discovery,review,asOf){
 if(!normalizeCapturedDate(asOf))fail("explicit cutoff must be an ISO calendar date");
 if(discovery?.mode!=="SYNTHETIC_OFFLINE_ONLY"||
    review?.mode!==REVIEW_MODE||
    discovery.network_requests!==0||discovery.crm_writes!==0||discovery.outbound_messages!==0||
    review.network_requests!==0||review.crm_writes!==0||review.outbound_messages!==0||
    review.handoff?.destination!=="NONE_OFFLINE_PREVIEW"||
    review.handoff?.crm_writes!==0||review.handoff?.outbound_messages!==0||
    review.real_contact_or_crm_authorization!==false)
   fail("input is not independently offline and side-effect free");
 if(!Array.isArray(discovery.leads)||!Array.isArray(review.review_queue)||
    !Array.isArray(review.handoff?.records)||!Array.isArray(review.audit_events)||
    !verifyAuditChain(review.audit_events))fail("missing or invalid audited queue");
 if(!Number.isSafeInteger(discovery.source_count)||discovery.source_count<1||
    !Number.isSafeInteger(discovery.extracted_businesses)||discovery.extracted_businesses<0||
    !Number.isSafeInteger(discovery.duplicates_merged)||discovery.duplicates_merged<0||
    !Number.isSafeInteger(discovery.lead_count)||discovery.lead_count<0||
    discovery.extracted_businesses-discovery.duplicates_merged!==discovery.lead_count||
    discovery.leads.length!==discovery.lead_count||
    review.review_queue.length!==discovery.lead_count)
   fail("contradictory discovery denominators");
 const sources=new Set(),sites=new Set(),queueSites=new Set();
 let provenance=0,proofs=0,fresh=0,reviewed=0;
 const cutoff=Date.parse(asOf+"T00:00:00.000Z");
 for(const row of discovery.leads){
  if(!syntheticHttpsUrl(row.business_website)||sites.has(row.business_website)||
     !Array.isArray(row.evidence)||row.evidence.length<1||
     row.crm_write_authorized!==false||row.outreach_authorized!==false||
     row.verified_hiring_signal!==false)
   fail("invalid fictional lead or unverifiable provenance");
  sites.add(row.business_website);
  let valid=0;
  for(const proof of row.evidence){
   const src=syntheticHttpsUrl(proof?.source_url),day=normalizeCapturedDate(proof?.captured_on);
   if(!src||!day||proof.evidence_type!=="JSON-LD Organization")fail("unknown or missing proof");
   const delta=(cutoff-Date.parse(day+"T00:00:00.000Z"))/86400000;
   if(delta<0)fail("evidence is dated in the future");
   const unique=src.href+"|"+day+"|"+row.business_website;
   if(sources.has(unique))fail("repeated source proof can inflate metrics");
   sources.add(unique);valid++;proofs++;
   if(delta<=30)fresh++;
  }
  if(valid)provenance++;
 }
 const counts={pending_growth:0,pending_crm:0,rejected:0,approved_offline:0};
 for(const row of review.review_queue){
  if(!sites.has(row.business_website)||queueSites.has(row.business_website)||
     !["pending_growth_review","pending_crm_review","rejected","approved_for_offline_handoff"].includes(row.review_status)||
     row.outreach_authorized!==false||row.crm_write_authorized!==false)
   fail("review identity, status or security conflict");
  queueSites.add(row.business_website);
  if(row.review_status==="pending_growth_review")counts.pending_growth++;
  else if(row.review_status==="pending_crm_review")counts.pending_crm++;
  else if(row.review_status==="rejected")counts.rejected++;
  else counts.approved_offline++;
  const growth=(row.review_records||[]).filter(x=>x.reviewer_role==="growth_reviewer");
  if(growth.length>1)fail("multiple growth decisions");
  if(growth.length===1)reviewed++;
 }
 if(JSON.stringify(counts)!==JSON.stringify(review.counts))fail("review totals disagree with signed-offline audit preview");
 if(counts.approved_offline!==review.handoff.records.length)fail("offline handoff cannot be trusted");
 for(const row of review.handoff.records){
  if(!sites.has(row.business_website)||row.crm_write_authorized!==false||
     row.outreach_authorized!==false||row.requires_separate_live_crm_approval!==true)
   fail("unsafe or foreign handoff record");
 }
 return {
  mode:"SYNTHETIC_OFFLINE_AGGREGATES_ONLY",reporting_cutoff:asOf,
  report_category:"C_LEAD_DISCOVERY_NOT_OPERATIONAL",actual_prospects:0,
  approved_live_sources:0,network_requests:0,crm_writes:0,outbound_messages:0,
  fixture_only:true,live_conversion_rate:null,actual_reply_rate:null,
  operational_baseline_accepted:false,
  totals:{snapshot_sources:discovery.source_count,extracted_entries:discovery.extracted_businesses,
   unique_fictional_businesses:discovery.lead_count,duplicates_merged:discovery.duplicates_merged,
   unique_dated_proofs:proofs,pending_growth:counts.pending_growth,pending_crm:counts.pending_crm,
   rejected:counts.rejected,approved_offline_preview:counts.approved_offline},
  measures:{
   provenance_coverage:rate(provenance,discovery.lead_count),
   source_freshness_30d:rate(fresh,proofs),
   deduplication_ratio:rate(discovery.duplicates_merged,discovery.extracted_businesses),
   growth_review_completion:rate(reviewed,discovery.lead_count),
   offline_handoff_preview_yield:rate(counts.approved_offline,discovery.lead_count)
  }
 };
}
export async function runSyntheticKpiFixture(manifest,decisions,asOf){
 const discovery=await runLocalManifest(manifest),review=await runLocalReview(manifest,decisions);
 return calculateSyntheticLeadKpis(discovery,review,asOf);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==5)throw new Error("Usage: metrics.mjs <synthetic-manifest> <fictional-decisions> <YYYY-MM-DD>");
  const report=await runSyntheticKpiFixture(process.argv[2],process.argv[3],process.argv[4]);
  process.stdout.write(JSON.stringify(report,null,2)+"\n");
 }catch(e){
  process.stderr.write("No lead KPI report released: "+e.message+"\n");
  process.exitCode=1;
 }
}
