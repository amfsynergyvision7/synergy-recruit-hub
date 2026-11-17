/**
 * Build168 — single-category, read-only owner acceptance handoff validator.
 * Does NOT authenticate reviewers, fetch URLs, approve sources, send, or write.
 */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {examineCategoryCApprovals} from "./approval-preflight.mjs";
const dir=dirname(fileURLToPath(import.meta.url));
const sha256=s=>createHash("sha256").update(s).digest("hex");
const digest=/^[a-f0-9]{64}$/;
const isoDay=s=>typeof s==="string" && /^\d{4}-\d\d-\d\d$/.test(s) &&
 Number.isFinite(Date.parse(s+"T00:00:00.000Z")) &&
 new Date(s+"T00:00:00.000Z").toISOString().slice(0,10)===s;
const fail=s=>{throw Error("Category C owner handoff refused: "+s)};
function checkOnlyFields(obj,expected){
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||
  Object.keys(obj).sort().join("|")!==[...expected].sort().join("|"))
  fail("unexpected review packet shape / possible private fields");
}
function safeEvidenceRef(s){
 if(typeof s!=="string"||s.length>512)return false;
 let u;try{u=new URL(s)}catch{return false}
 return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&!u.search&&
  !u.port&&["docs.google.com","drive.google.com","github.com"].includes(u.hostname)&&
  !u.pathname.includes("..")&&u.pathname.length>3;
}
function refs(list){
 if(!Array.isArray(list)||list.length>50||list.some(x=>!safeEvidenceRef(x))||
  new Set(list).size!==list.length)fail("invalid or duplicate owner source-terms references");
}
const ld02Fields=["schema","status","approved_scope_sha256","approved_policy_document_url",
 "approved_source_terms_document_urls","growth_owner_independent_review_url",
 "privacy_owner_independent_review_url","approved_on","owner_verification_performed","review_only","note"];
const ld05Fields=["schema","status","approved_kpi_policy_url","independent_growth_review_url",
 "independent_bi_review_url","authorized_business_only_source_approval_url",
 "independently_checked_aggregate_reference_url","cutoff_on","data_summary",
 "data_protection","owner_verification_performed","review_only","note"];
const countFields=["source_observation_count","unique_business_count","verified_public_source_count",
 "manually_reviewed_business_count","qualified_business_count","false_positive_count",
 "duplicates_excluded_count","independently_reconciled_mismatch_count"];
export function inspectIndependentCategoryCReview(policy,kpis,ld02,ld05){
 const draft=examineCategoryCApprovals(policy,kpis);
 checkOnlyFields(ld02,ld02Fields);
 checkOnlyFields(ld05,ld05Fields);
 checkOnlyFields(ld05.data_summary,countFields);
 checkOnlyFields(ld05.data_protection,["personal_contacts_collected","outbound_messages","crm_writes"]);
 if(ld02.schema!=="LD02-INDEPENDENT-DECISION-EVIDENCE-V1"||
  ld05.schema!=="LD05-INDEPENDENT-KPI-ACCEPTANCE-V1"||
  ld02.status!=="NOT_SUBMITTED"||ld05.status!=="NOT_SUBMITTED"||
  ld02.review_only!==true||ld05.review_only!==true||
  ld02.owner_verification_performed!==false||ld05.owner_verification_performed!==false)
  fail("draft evidence cannot claim owner verification or acceptance");
 if(ld05.data_protection.personal_contacts_collected!==false||
  ld05.data_protection.outbound_messages!==0||
  ld05.data_protection.crm_writes!==0)fail("contact or CRM side effects are forbidden");
 const scopeDigest=sha256(JSON.stringify(policy.required_decisions));
 if(ld02.approved_scope_sha256!==null&&
   (!digest.test(ld02.approved_scope_sha256)||ld02.approved_scope_sha256!==scopeDigest))
  fail("LD02 signed scope does not match reviewed policy fingerprint");
 refs(ld02.approved_source_terms_document_urls);
 const missingLD02=[...draft.LD02.missing],missingLD05=[...draft.LD05.missing];
 for(const [label,value] of [
  ["approved decision document",ld02.approved_policy_document_url],
  ["Growth independent review reference",ld02.growth_owner_independent_review_url],
  ["Privacy independent review reference",ld02.privacy_owner_independent_review_url]
 ]){
  if(value===null)missingLD02.push("LD02 "+label);
  else if(!safeEvidenceRef(value))fail("invalid LD02 "+label);
 }
 if(ld02.approved_scope_sha256===null)missingLD02.push("LD02 reviewed scope SHA-256 binding");
 if(!ld02.approved_source_terms_document_urls.length)
  missingLD02.push("LD02 independent source terms evidence");
 if(ld02.approved_on===null)missingLD02.push("LD02 dated approval record");
 else if(!isoDay(ld02.approved_on))fail("invalid LD02 decision date");
 const sameReviewer=ld02.growth_owner_independent_review_url!==null &&
  ld02.growth_owner_independent_review_url===ld02.privacy_owner_independent_review_url;
 if(sameReviewer)fail("two review roles cannot rely on the identical signoff record");
 const ld05Ref=[
  ["KPI definitions and target approval",ld05.approved_kpi_policy_url],
  ["Growth KPI independent review",ld05.independent_growth_review_url],
  ["BI KPI independent review",ld05.independent_bi_review_url],
  ["authorized organization-only sources",ld05.authorized_business_only_source_approval_url],
  ["independently reconciled aggregate sample",ld05.independently_checked_aggregate_reference_url]
 ];
 for(const [label,value] of ld05Ref){
  if(value===null)missingLD05.push("LD05 "+label);
  else if(!safeEvidenceRef(value))fail("invalid LD05 "+label);
 }
 if(ld05.independent_growth_review_url!==null&&
    ld05.independent_growth_review_url===ld05.independent_bi_review_url)
  fail("Growth and BI review references must be separate");
 if(ld05.cutoff_on===null)missingLD05.push("LD05 dated cohort cutoff");
 else if(!isoDay(ld05.cutoff_on))fail("invalid LD05 cohort cutoff");
 const c=ld05.data_summary;
 for(const key of countFields){
  if(c[key]===null)missingLD05.push("LD05 independent aggregate "+key);
  else if(!Number.isSafeInteger(c[key])||c[key]<0)
   fail("invalid LD05 nonnegative aggregate "+key);
 }
 if(countFields.every(key=>c[key]!==null)){
  if(c.source_observation_count===0||c.unique_business_count===0||
   c.manually_reviewed_business_count===0||
   c.unique_business_count>c.source_observation_count||
   c.verified_public_source_count>c.source_observation_count||
   c.manually_reviewed_business_count>c.unique_business_count||
   c.qualified_business_count>c.manually_reviewed_business_count||
   c.false_positive_count>c.manually_reviewed_business_count||
   c.duplicates_excluded_count>c.source_observation_count||
   c.independently_reconciled_mismatch_count>c.manually_reviewed_business_count)
   fail("LD05 invalid aggregate consistency / empty denominators");
 }
 return {
  mode:"REVIEW_ONLY_NO_APPROVAL",
  category:"C",policy_scope_sha256:scopeDigest,
  evidence_packets_checked:2,
  ld02:{missing:missingLD02,review_packet_fields_complete:missingLD02.length===0,accepted:false},
  ld05:{missing:missingLD05,review_packet_fields_complete:missingLD05.length===0,accepted:false},
  formal_category_points:6,formal_project_points:26,
  registered_release_signoffs:0,actual_prospects_read:0,
  independent_identity_verified:false,
  real_source_access_authorized:false,live_outreach_allowed:false,
  crm_writes:0,external_messages:0,production_enabled:false,
  next_action:"Obtain separately verifiable signed Growth/Privacy LD02 decision and an authorized independently reconciled Growth/BI LD05 sample. Re-evaluate frozen official rubric only after external verification.",
  warning:"Populated fields are metadata only; cannot cryptographically authenticate a reviewer, confirm source terms, validate real evidence or accept milestones."
 };
}
const read=x=>JSON.parse(readFileSync(join(dir,x),"utf8"));
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==2)fail("no external file arguments; approved document intake is separate");
  const output=inspectIndependentCategoryCReview(
   read("lead-policy.review.json"),read("kpi-acceptance.review.json"),
   read("ld02-independent-evidence.review.json"),read("ld05-independent-sample.review.json")
  );
  process.stdout.write(JSON.stringify(output,null,2)+"\n");
 }catch(e){process.stderr.write(e.message+"\n");process.exitCode=1}
}
