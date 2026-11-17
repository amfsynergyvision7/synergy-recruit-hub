/** Build166 review-only gap reporting; never authorizes lead sourcing or KPI acceptance. */
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {isIP} from "node:net";
const dir=dirname(fileURLToPath(import.meta.url));
const text=x=>typeof x==="string"&&x.trim().length>=2&&x.length<=140&&!/[<>@\x00-\x1f\x7f]/.test(x);
const list=x=>Array.isArray(x)&&x.length>0&&x.length<=50&&x.every(text);
const date=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 !Number.isNaN(Date.parse(x+"T00:00:00.000Z"))&&
 new Date(x+"T00:00:00.000Z").toISOString().slice(0,10)===x;
function publicSource(value){
 if(typeof value!=="string"||value.length>400)return false;
 let u;try{u=new URL(value)}catch{return false}
 const h=u.hostname.toLowerCase();
 // A whitelist contains only exact HTTPS origins, not full URLs, redirects,
 // query tokens, credentials, private/reserved names or personal links.
 return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.hash&&!isIP(h)&&
  (value==="https://"+h||value==="https://"+h+"/")&&
  h.length<=253&&h.includes(".")&&!h.includes("..")&&
  ![".invalid",".localhost",".local",".internal",".test",".onion",".example"].some(t=>h.endsWith(t))&&
  h.split(".").every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(x));
}
export function examineCategoryCApprovals(policy,kpi){
 if(policy?.status!=="REVIEW_DRAFT_NOT_APPROVED"||
    policy.live_lead_discovery_enabled!==false||
    kpi?.status!=="REVIEW_DRAFT_NOT_APPROVED"||
    kpi.live_kpi_acceptance_enabled!==false)
  throw Error("Live policy rejected from an offline review preflight");
 const p=policy.required_decisions,g=policy.independent_approval,
  k=kpi.acceptance;
 if(!p||!g||!k||!Array.isArray(kpi.measures)||kpi.measures.length!==6)
   throw Error("Missing LD02/LD05 packet");
 if(p.no_personal_profile_extraction!==true||p.no_auto_contact!==true||
   p.crm_writes_allowed!==false)throw Error("Policy would remove hard safety holds");
 const urls=p.permitted_public_business_sources;
 if(!Array.isArray(urls)||urls.some(x=>!publicSource(x))||new Set(urls).size!==urls.length)
  throw Error("Invalid or duplicate public HTTPS source");
 const ld02=[];
 for(const [key,lab] of [["target_industries","industry ICP"],
  ["target_geographies","target geographies"],["buyer_personas","business buyer roles"],
  ["permitted_public_business_sources","source whitelist"],
  ["excluded_sources","source exclusions"]])
   if(key==="permitted_public_business_sources"?!urls.length:!list(p[key]))
    ld02.push("LD02 "+lab);
 if(!text(p.lawful_business_research_basis))ld02.push("LD02 lawful basis");
 if(!Number.isInteger(p.retention_days)||p.retention_days<1||p.retention_days>3650)
  ld02.push("LD02 retention period");
 if(p.public_source_terms_verified!==true)ld02.push("LD02 source terms review");
 if(!text(g.growth_owner)||!text(g.privacy_compliance_owner)||!date(g.approved_on))
  ld02.push("LD02 independently verified Growth/Privacy signatures");
 const expectedKpis=new Set([
  "provenance_coverage","source_freshness_30d","deduplication_ratio",
  "growth_review_completion","offline_handoff_preview_yield","actual_meeting_conversion"
 ]);
 const ld05=[],ids=new Set();
 for(const row of kpi.measures){
  if(!text(row.id)||!expectedKpis.has(row.id)||ids.has(row.id))throw Error("Invalid or duplicate KPI identifier");
  ids.add(row.id);
  if(row.approved_target==null)ld05.push("LD05 target "+row.id);
  else if(typeof row.approved_target!=="number"||!Number.isFinite(row.approved_target)||
   row.approved_target<0||row.approved_target>1)throw Error("Invalid KPI ratio target");
 }
 if(kpi.cutoff_timezone!=="Asia/Kolkata"||kpi.denominator_empty!=="N/A, never zero")
  throw Error("KPI timezone or denominator semantics drift");
 if(k.business_source_access_approved!==true)ld05.push("LD05 authorized sources");
 if(!Number.isInteger(k.real_source_observation_count)||k.real_source_observation_count<1)
  ld05.push("LD05 real source observation evidence");
 if(!Number.isInteger(k.human_verified_sample_count)||k.human_verified_sample_count<1)
  ld05.push("LD05 manually verified sample");
 if(k.comparison_with_manually_checked_source!==true)
  ld05.push("LD05 independent reconciliation");
 if(!text(k.growth_owner)||!text(k.bi_owner)||!date(k.accepted_on))
  ld05.push("LD05 independently verified Growth/BI signatures");
 return {
  category:"C",mode:"DRAFT_READINESS_DIAGNOSTIC_ONLY",
  LD02:{review_fields_complete:ld02.length===0,missing:ld02,independently_accepted:false},
  LD05:{review_fields_complete:ld05.length===0,missing:ld05,independently_accepted:false},
  official_category_points:6,possible_points:10,live_lead_access_authorized:false,
  release_authorized:false,
  note:"Text in a review file is not an independently verified approval, even if every field is populated."
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const p=JSON.parse(readFileSync(join(dir,"lead-policy.review.json"),"utf8"));
 const k=JSON.parse(readFileSync(join(dir,"kpi-acceptance.review.json"),"utf8"));
 process.stdout.write(JSON.stringify(examineCategoryCApprovals(p,k),null,2)+"\n");
}
