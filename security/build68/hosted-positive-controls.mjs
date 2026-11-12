/**
 * Build68: positive control for the 16 synthetic private surfaces.
 * A zero-row anonymous result alone cannot prove RLS: an empty source
 * table/view produces the same observation. An approved real GoTrue admin
 * must see at least one seeded synthetic row from EVERY tested surface.
 *
 * All 16 surface queries are HEAD metadata only. No candidate/client/
 * finance row contents are read, returned or logged.
 */
import {pathToFileURL} from "node:url";
import {assertUnprivilegedUatKey} from "../build66/uat-key-gate.mjs";
import {PRIVATE_EXTRA_TABLES,PUBLIC_VIEWS,runAnonymousSurfacePreflight}
 from "../build66/hosted-anon-extra-scope.mjs";
const HOST="dhlhlasnaapzckjyvffn.supabase.co";
const ACK="I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES";
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const CONTROL_SURFACES=Object.freeze([...PRIVATE_EXTRA_TABLES,...PUBLIC_VIEWS]);
const stop=message=>{throw new Error("Build68 positive-control STOP: "+message)};
export function parseExactRange(value){
 if(typeof value!=="string")return null;
 const m=/^(?:\*|\d+-\d+)\/(\d+)$/.exec(value.trim());
 if(!m)return null;
 const count=Number(m[1]);
 return Number.isSafeInteger(count)&&count>=0?count:null;
}
export async function runHostedPositiveControls(config,http=fetch){
 let url;
 try{url=new URL(config?.url)}catch{stop("missing or invalid UAT URL")}
 if(url.protocol!=="https:"||url.hostname!==HOST||url.pathname!=="/"||url.search||
    url.hash||url.port||url.username||url.password)
  stop("only the dedicated nonproduction synthetic host is allowed");
 if(config?.fixtureAck!==ACK)stop("approved and seeded synthetic fixtures required");
 const key=config?.anonKey;
 assertUnprivilegedUatKey(key);
 const admin=config?.admin;
 if(typeof admin?.email!=="string"||!admin.email.includes("@")||
    typeof admin?.password!=="string"||!admin.password.trim()||
    typeof admin?.expectedUserId!=="string"||!UUID.test(admin.expectedUserId))
  stop("approved admin login and pinned synthetic hosted UUID required");
 if(CONTROL_SURFACES.length!==16||new Set(CONTROL_SURFACES).size!==16)
  stop("exact sixteen-surface positive-control inventory required");
 const origin=url.origin;
 const call=async(path,options)=>{
  const u=new URL(origin+path);
  const forToken=u.pathname==="/auth/v1/token"&&u.search==="?grant_type=password"&&options.method==="POST";
  const forIdentity=u.pathname==="/auth/v1/user"&&!u.search&&options.method==="GET";
  const forProfile=u.pathname==="/rest/v1/profiles"&&
   u.search==="?select=id,status,is_active&id=eq."+admin.expectedUserId&&options.method==="GET";
  const forRole=u.pathname==="/rest/v1/user_roles"&&
   u.search==="?select=user_id,role&user_id=eq."+admin.expectedUserId&&options.method==="GET";
  const forSurface=CONTROL_SURFACES.some(name=>u.pathname==="/rest/v1/"+name)&&
   u.search==="?select=*&limit=1"&&options.method==="HEAD";
  if(u.origin!==origin||u.hash||u.username||u.password||
     !(forToken||forIdentity||forProfile||forRole||forSurface))
   stop("unapproved request method, path or query");
  try{return await http(u.href,{...options,redirect:"error",signal:AbortSignal.timeout(10000)})}
  catch{stop("hosted positive-control transport refused or redirected")}
 };
 const login=await call("/auth/v1/token?grant_type=password",{
  method:"POST",headers:{apikey:key,"Content-Type":"application/json"},
  body:JSON.stringify({email:admin.email,password:admin.password})
 });
 if(!login?.ok||login.status!==200)stop("synthetic admin GoTrue login failed");
 const session=await login.json().catch(()=>null);
 const token=session?.access_token;
 if(typeof token!=="string"||session.user?.id!==admin.expectedUserId)
  stop("admin GoTrue session or approved UUID mismatch");
 const chunks=token.split(".");
 if(chunks.length!==3)stop("malformed admin JWT");
 let claims;
 try{claims=JSON.parse(Buffer.from(chunks[1],"base64url").toString("utf8"))}
 catch{stop("malformed admin JWT claims")}
 if(claims?.role!=="authenticated"||claims?.sub!==admin.expectedUserId||
    !Number.isSafeInteger(claims?.exp)||claims.exp<=Math.floor(Date.now()/1000))
  stop("privileged, expired or mismatched admin JWT");
 const headers={apikey:key,Authorization:"Bearer "+token,Accept:"application/json"};
 const who=await call("/auth/v1/user",{method:"GET",headers});
 if(who?.status!==200)stop("admin GoTrue identity not verifiable");
 const user=await who.json().catch(()=>null);
 if(user?.id!==admin.expectedUserId)stop("admin identity does not match approved fixture");
 const profileRes=await call("/rest/v1/profiles?select=id,status,is_active&id=eq."+admin.expectedUserId,
  {method:"GET",headers});
 const roleRes=await call("/rest/v1/user_roles?select=user_id,role&user_id=eq."+admin.expectedUserId,
  {method:"GET",headers});
 if(profileRes?.status!==200||roleRes?.status!==200)stop("admin fixture integrity unavailable");
 const profiles=await profileRes.json().catch(()=>null);
 const roles=await roleRes.json().catch(()=>null);
 if(!Array.isArray(profiles)||profiles.length!==1||
    profiles[0]?.id!==admin.expectedUserId||profiles[0]?.status!=="approved"||
    profiles[0]?.is_active!==true||
    !Array.isArray(roles)||roles.length!==1||
    roles[0]?.user_id!==admin.expectedUserId||roles[0]?.role!=="admin")
  stop("synthetic admin profile or role invalid");
 const outcomes=[];
 for(const surface of CONTROL_SURFACES){
  const response=await call("/rest/v1/"+surface+"?select=*&limit=1",{
   method:"HEAD",headers:{...headers,Prefer:"count=exact"}
  });
  const count=[200,206].includes(response?.status)?
   parseExactRange(response?.headers?.get?.("content-range")):null;
  const pass=count!==null&&count>=1;
  outcomes.push({case_id:"positive:"+surface,admin_visible_count:count,
   response_status:response?.status??null,pass});
 }
 const passed=outcomes.filter(x=>x.pass).length;
 return {
  status:passed===16?"PROVISIONAL_POSITIVE_FIXTURES_READY_NOT_ACCEPTED":
   "POSITIVE_FIXTURES_INCOMPLETE_NOT_ACCEPTED",
  checks:16,passed,failed:16-passed,identity_verified:true,
  admin_role_verified:true,raw_private_rows_downloaded:0,
  formal_hosted_acceptance:0,case_results:outcomes
 };
}
export async function runCrosscheckedHostedSurface(config,http=fetch){
 const positive=await runHostedPositiveControls(config,http);
 if(positive.failed!==0){
  return {status:"CROSSCHECK_STOP_POSITIVE_FIXTURES_INCOMPLETE",
   positive,anonymous:null,formal_hosted_acceptance:0};
 }
 const anonymous=await runAnonymousSurfacePreflight(config,http);
 return {status:anonymous.failed===0?"CROSSCHECK_PROVISIONAL_PASS_NOT_RELEASE":
  "CROSSCHECK_ANON_FAILURE_NOT_RELEASE",
  positive,anonymous,formal_hosted_acceptance:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config={
  url:process.env.AMF_UAT_SUPABASE_URL,
  anonKey:process.env.AMF_UAT_ANON_KEY,
  fixtureAck:process.env.AMF_UAT_SYNTHETIC_135_FIXTURE_ACK,
  admin:{
   email:process.env.AMF_UAT_CASE_01_EMAIL,
   password:process.env.AMF_UAT_CASE_01_PASSWORD,
   expectedUserId:process.env.AMF_UAT_CASE_01_EXPECTED_UUID
  }
 };
 runCrosscheckedHostedSurface(config).then(report=>{
  process.stdout.write(JSON.stringify(report)+"\n");
  if(report.status!=="CROSSCHECK_PROVISIONAL_PASS_NOT_RELEASE")process.exitCode=1;
 }).catch(error=>{
  process.stderr.write(String(error?.message||"Positive controls unavailable")+"\n");
  process.exitCode=1;
 });
}
