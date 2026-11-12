/**
 * Build66: dedicated, pre-seeded nonproduction anonymous-surface spot checks
 * for four previously untested production tables and 13 views.
 * READ ONLY. Does not run against live production, send service role keys,
 * return raw records, or constitute authorization/release acceptance.
 */
import {pathToFileURL} from "node:url";
import {assertUnprivilegedUatKey} from "./uat-key-gate.mjs";
const HOST="dhlhlasnaapzckjyvffn.supabase.co";
const ACK="I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES";
export const PRIVATE_EXTRA_TABLES=Object.freeze(["candidate_stage_history","email_log","workflow_rules"]);
export const PUBLIC_VIEWS=Object.freeze([
 "available_recruiters","candidates_for_assignment","recruiter_performance",
 "recruiter_performance_with_names","recruiter_stats","recruiter_summary",
 "vw_billing_filters","vw_candidate_filters","vw_client_filters",
 "vw_interview_filters","vw_job_filters","vw_offer_filters","vw_submission_filters"
]);
export const PRIVATE_BRANDING_COLUMNS=Object.freeze(["resume_import_folder_url","updated_by","updated_at"]);
export const PUBLIC_BRANDING_COLUMNS=Object.freeze(["logo_url","default_color_theme"]);
const stop=reason=>{throw new Error("Build66 hosted anonymous preflight blocked: "+reason)};
export async function runAnonymousSurfacePreflight(config,http=fetch){
 let u;
 try{u=new URL(config?.url)}catch{stop("invalid hosted UAT URL")}
 if(u.protocol!=="https:"||u.hostname!==HOST||u.pathname!=="/"||u.search||u.hash||
    u.port||u.username||u.password)stop("only dedicated synthetic nonproduction host is allowed");
 if(config?.fixtureAck!==ACK)stop("exact pre-seeded synthetic fixture acknowledgment required");
 const key=config?.anonKey;
 assertUnprivilegedUatKey(key);
 const base=u.origin;
 const cases=[
  ...PRIVATE_EXTRA_TABLES.map(table=>({name:"table:"+table,path:table,query:"select=id&limit=1",expect:"empty-or-denied"})),
  ...PUBLIC_VIEWS.map(view=>({name:"view:"+view,path:view,query:"select=*&limit=1",expect:"empty-or-denied"})),
  ...PRIVATE_BRANDING_COLUMNS.map(col=>({name:"branding-private:"+col,path:"app_settings",
   query:"select="+col+"&limit=1",expect:"explicit-denial"})),
  {name:"branding-public:projection",path:"app_settings",
   query:"select="+PUBLIC_BRANDING_COLUMNS.join(",")+"&limit=2",expect:"exact-one"}
 ];
 if(cases.length!==20)stop("incomplete 20-probe surface inventory");
 const outcomes=[];
 for(const c of cases){
  const target=base+"/rest/v1/"+c.path+"?"+c.query;
  const url=new URL(target);
  if(url.origin!==base||url.hash||url.username||url.password||
     url.pathname!=="/rest/v1/"+c.path||url.search!=="?"+c.query)
    stop("bad request route");
  // Metadata-only PostgREST HEAD with Prefer: count=exact. Never read
  // the response body: it might contain private rows if RLS fails.
  let response;
  try{
   response=await http(target,{method:"HEAD",redirect:"error",
    signal:AbortSignal.timeout(10000),
    headers:{apikey:key,Prefer:"count=exact",Accept:"application/json"}});
  }catch{stop("hosted test network failure or redirect")}
  const status=response?.status;
  const rawRange=response?.headers?.get?.("content-range");
  const range=typeof rawRange==="string"?
    /^(?:\*|\d+-\d+)\/(\d+)$/.exec(rawRange.trim()):null;
  const count=range?Number(range[1]):null;
  const validCount=Number.isSafeInteger(count)&&count>=0;
  const observed=validCount&&[200,206].includes(status)?count:null;
  const pass=c.expect==="empty-or-denied"?
    (([200,206].includes(status)&&validCount&&count===0)||[401,403].includes(status)):
    c.expect==="explicit-denial"?
      [401,403].includes(status):
      [200,206].includes(status)&&validCount&&count===1;
  outcomes.push({case_id:c.name,expected:c.expect,http_status:status,
   observed_row_count:observed,pass});
 }
 const successes=outcomes.filter(x=>x.pass).length;
 return {status:successes===20?"PROVISIONAL_ANON_SURFACE_PASS_NOT_RELEASE":
  "PROVISIONAL_ANON_SURFACE_FAIL_NOT_RELEASE",dedicated_nonproduction_only:true,
  synthetic_fixture_required:true,checks:20,passed:successes,failed:20-successes,
  formal_hosted_acceptance:0,live_production_changed:false,case_results:outcomes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runAnonymousSurfacePreflight({
  url:process.env.AMF_UAT_SUPABASE_URL,
  anonKey:process.env.AMF_UAT_ANON_KEY,
  fixtureAck:process.env.AMF_UAT_SYNTHETIC_135_FIXTURE_ACK
 }).then(result=>{
  process.stdout.write(JSON.stringify(result)+"\n");
  if(result.failed)process.exitCode=1;
 }).catch(e=>{
  process.stderr.write(String(e?.message||"Anonymous surface acceptance unavailable")+"\n");
  process.exitCode=1;
 });
}
