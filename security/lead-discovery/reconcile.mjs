/**
 * Build167 LD05 separate, manually curated synthetic ground-truth audit.
 * No API, prospects, candidate information, network, or signed approval.
 * Reconciliation is AGAINST a separately hand-authored oracle, NOT the same
 * calculated KPI summary. All inputs must remain synthetic and inert.
 */
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {runLocalManifest,syntheticHttpsUrl,normalizeCapturedDate} from "./discover.mjs";
import {runLocalReview} from "./review.mjs";
import {calculateSyntheticLeadKpis} from "./metrics.mjs";

export const ORACLE_MODE="MANUALLY_CURATED_SYNTHETIC_REFERENCE_ONLY";
function fail(s){throw Error("Curated synthetic audit refused: "+s)}
function expectedRecord(x){
 if(!x || !syntheticHttpsUrl(x.website) || !x.website.startsWith("https://") ||
   !["approved_for_offline_handoff","rejected","pending_crm_review","pending_growth_review"].includes(x.review_status) ||
   !Array.isArray(x.evidence) || !x.evidence.length ||
   !x.evidence.every(e=>syntheticHttpsUrl(e.source_url)&&normalizeCapturedDate(e.captured_on)))
   fail("oracle has an invalid business or dated source");
 return x;
}
function proofSignature(arr){
 return arr.map(x=>x.source_url+"|"+x.captured_on).sort().join(";");
}
export function reconcileCuratedSyntheticReference(discovery,review,reference){
 if(reference?.schema!=="synthetic-curated-reconciliation-v1"||
    reference.mode!==ORACLE_MODE||reference.reviewer_signoff!==false||
    !normalizeCapturedDate(reference.as_of)||!Array.isArray(reference.businesses)||
    reference.businesses.length<1||reference.businesses.length>30||
    !reference.totals||!reference.expected_measures)
  fail("not a bounded, unsigned synthetic reference packet");
 const names=new Set(),sources=new Set();
 for(const row of reference.businesses){
  expectedRecord(row);
  if(names.has(row.website))fail("duplicate oracle company website");
  names.add(row.website);
  for(const p of row.evidence){
   const key=row.website+"|"+p.source_url+"|"+p.captured_on;
   if(sources.has(key))fail("duplicate oracle dated proof");
   sources.add(key);
  }
 }
 const kpis=calculateSyntheticLeadKpis(discovery,review,reference.as_of);
 const mismatches=[];
 const diff=(code,expected,observed)=>{
   if(JSON.stringify(expected)!==JSON.stringify(observed))
    mismatches.push({code,expected,observed});
 };
 const totals=Object.keys(reference.totals).sort();
 const expectedTotals=["snapshot_sources","extracted_entries","duplicates_merged",
  "unique_fictional_businesses","unique_dated_proofs","pending_growth",
  "pending_crm","rejected","approved_offline_preview"];
 if(totals.join(",")!==expectedTotals.sort().join(","))fail("oracle totals keys drift");
 for(const key of expectedTotals){
  const value=reference.totals[key];
  if(!Number.isSafeInteger(value)||value<0)fail("oracle expected integer invalid");
  diff("TOTAL_"+key,value,kpis.totals[key]);
 }
 if(reference.totals.unique_fictional_businesses!==reference.businesses.length)
   fail("oracle fixture count contradicts business list");
 const observedCompanies=new Map(discovery.leads.map(x=>[x.business_website,x]));
 const reviewCompanies=new Map(review.review_queue.map(x=>[x.business_website,x]));
 for(const row of reference.businesses){
  const business=observedCompanies.get(row.website),reviewer=reviewCompanies.get(row.website);
  diff("COMPANY_"+row.website+"_name",row.name,business?.company_name??null);
  diff("COMPANY_"+row.website+"_city",row.city,business?.location??null);
  diff("COMPANY_"+row.website+"_industry",row.industry,business?.industry??null);
  diff("COMPANY_"+row.website+"_review",row.review_status,reviewer?.review_status??null);
  diff("COMPANY_"+row.website+"_proof",proofSignature(row.evidence),
   business?.evidence?proofSignature(business.evidence):null);
 }
 diff("BUSINESS_POPULATION",reference.businesses.map(x=>x.website).sort(),
  [...observedCompanies.keys()].sort());
 const expectedMetrics=["provenance_coverage","source_freshness_30d",
  "deduplication_ratio","growth_review_completion","offline_handoff_preview_yield"].sort();
 if(Object.keys(reference.expected_measures).sort().join(",")!==expectedMetrics.join(","))
  fail("oracle metrics list drift");
 for(const name of expectedMetrics){
  const x=reference.expected_measures[name];
  if(!Number.isSafeInteger(x?.numerator)||!Number.isSafeInteger(x?.denominator)||
   x.numerator<0||x.denominator<0||x.numerator>x.denominator)
   fail("oracle expected numerator/denominator invalid");
  diff("KPI_"+name,{numerator:x.numerator,denominator:x.denominator},
   {numerator:kpis.measures[name].numerator,denominator:kpis.measures[name].denominator});
 }
 return {
  mode:"SYNTHETIC_MANUAL_REFERENCE_RECONCILIATION",
  reference_cutoff:reference.as_of,reference_business_count:reference.businesses.length,
  source_only:true,real_business_observations:0,
  owner_signed:false,live_approved:false,outbound_messages:0,crm_writes:0,
  independent_operational_acceptance:false,
  checks_compared:expectedTotals.length+reference.businesses.length*5+1+expectedMetrics.length,
  mismatch_count:mismatches.length,mismatches,
  verdict:mismatches.length?"FAIL_SYNTHETIC_MISMATCH":"PASS_SYNTHETIC_ONLY",
  note:"A manually specified fictional reference proves test reconciliation only; LD05 operational sample and independent Growth/BI acceptance remain open."
 };
}
export async function runCuratedSyntheticReference(manifest,decisions){
 const oracle=JSON.parse(readFileSync(new URL("./curated-reference.synthetic.json",import.meta.url),"utf8"));
 const discovery=await runLocalManifest(manifest),review=await runLocalReview(manifest,decisions);
 return reconcileCuratedSyntheticReference(discovery,review,oracle);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)throw Error("Usage: reconcile.mjs <synthetic-manifest> <synthetic-review-decisions>");
  const result=await runCuratedSyntheticReference(process.argv[2],process.argv[3]);
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  if(result.mismatch_count)process.exitCode=1;
 }catch(err){process.stderr.write("Synthetic reference check failed: "+err.message+"\n");process.exitCode=1}
}
