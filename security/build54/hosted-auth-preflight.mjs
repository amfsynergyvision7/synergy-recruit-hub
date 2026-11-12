/**
 * Build54: real hosted Supabase Auth and RLS acceptance ENTRY GATE.
 *
 * Strictly READ-ONLY for CRM tables. Only the dedicated empty nonproduction
 * project may be targeted. Fails closed without three actual GoTrue password
 * sessions AND two pre-seeded synthetic candidate fixtures. No tokens,
 * identities, passwords or candidate records are printed.
 *
 * This is a preflight for the historical 140-case acceptance, NOT a substitute.
 */
import {pathToFileURL} from "node:url";
const UAT_HOST="dhlhlasnaapzckjyvffn.supabase.co";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const requireValue=(value,label)=>{
 if(!value || typeof value!=="string" || !value.trim())
   throw new Error("Missing "+label+"; no hosted test was performed");
 return value.trim();
};
const fail=(reason)=>{throw new Error("Hosted UAT preflight blocked: "+reason)};
async function jsonResponse(request,reason){
 if(!request.ok) fail(reason+" HTTP "+request.status);
 const result=await request.json().catch(()=>fail(reason+" malformed response"));
 if(result===null||typeof result!=="object")fail(reason+" not JSON");
 return result;
}
export async function runHostedReadOnlyPreflight(config,http=fetch){
 const url=requireValue(config.url,"AMF_UAT_SUPABASE_URL");
 let parsed;
 try{parsed=new URL(url)}catch{fail("invalid project URL")}
 if(parsed.protocol!=="https:" || parsed.hostname!==UAT_HOST ||
    parsed.pathname!=="/" || parsed.search || parsed.hash || parsed.username || parsed.password)
  fail("only the dedicated nonproduction Supabase project is allowed");
 const key=requireValue(config.anonKey,"AMF_UAT_ANON_KEY");
 const roles=[
  {name:"admin",email:config.adminEmail,password:config.adminPassword,expect:"admin"},
  {name:"recruiter",email:config.recruiterEmail,password:config.recruiterPassword,expect:"recruiter"},
  {name:"pending",email:config.pendingEmail,password:config.pendingPassword,expect:null},
 ];
 const normalized=roles.map(r=>requireValue(r.email,r.name+" email").toLowerCase());
 roles.forEach(r=>requireValue(r.password,r.name+" password"));
 if(new Set(normalized).size!==roles.length)fail("test users must be distinct");
 const ownedId=requireValue(config.ownedCandidateId,"AMF_UAT_OWNED_CANDIDATE_ID");
 const otherId=requireValue(config.otherCandidateId,"AMF_UAT_OTHER_CANDIDATE_ID");
 if(!uuid.test(ownedId)||!uuid.test(otherId)||ownedId===otherId)
  fail("two distinct synthetic UUID candidate fixtures required");
 const base=parsed.origin;
 const headers={apikey:key,"Content-Type":"application/json"};
 let checks=0;
 const sessions={};
 for(const role of roles){
  const token=await jsonResponse(await http(base+"/auth/v1/token?grant_type=password",{
   method:"POST",headers,body:JSON.stringify({email:role.email,password:role.password})
  }),"real GoTrue login unavailable for "+role.name);
  if(!token.access_token || !uuid.test(token.user?.id))
   fail("GoTrue token/user integrity missing for "+role.name);
  const user=await jsonResponse(await http(base+"/auth/v1/user",{
   method:"GET",headers:{apikey:key,Authorization:"Bearer "+token.access_token}
  }),"GoTrue user lookup failed for "+role.name);
  if(user.id!==token.user.id)fail("GoTrue token identity mismatch");
  checks+=2;
  const h={apikey:key,Authorization:"Bearer "+token.access_token};
  const fetchRows=async(table,params,reason)=>{
    const response=await jsonResponse(await http(
      base+"/rest/v1/"+table+"?"+params,
      {method:"GET",headers:h}
    ),reason);
    if(!Array.isArray(response)) fail("unexpected "+table+" read shape");
    return response;
  };
  const profile=await fetchRows("profiles",
    "select=id,status,is_active&id=eq."+token.user.id,
    "profile policy did not permit own-row read");
  if(profile.length!==1 || profile[0]?.id!==token.user.id)fail("exact scoped self-profile required for "+role.name);
  const approved=profile[0].status==="approved" && profile[0].is_active===true;
  if(approved !== (role.expect!==null))fail("test profile status wrong for "+role.name);
  checks++;
  const roleRows=await fetchRows("user_roles",
    "select=role&user_id=eq."+token.user.id,
    "user_roles RLS read failed");
  const declaredRoles=new Set(roleRows.map(row=>row.role));
  if(role.expect===null){
    if(declaredRoles.has("admin")||declaredRoles.has("recruiter"))
     fail("pending test account has a privileged role");
  }else if(!declaredRoles.has(role.expect))fail("missing approved "+role.expect+" role");
  if(role.expect==="recruiter" && declaredRoles.has("admin"))fail("recruiter test account has admin privilege");
  checks++;
  sessions[role.name]={headers:h,approved};
 }
 const query=(id)=>"select=id&id=eq."+id;
 const list=async(session,id)=>{
  const res=await jsonResponse(await http(base+"/rest/v1/candidates?"+query(id),
   {method:"GET",headers:sessions[session].headers}
  ),"candidate RLS read failed");
  if(!Array.isArray(res))fail("candidate list response not array");
  return res;
 };
 const exactOne=(rows,id)=>rows.length===1 && rows[0]?.id===id;
 if(!exactOne(await list("recruiter",ownedId),ownedId))fail("recruiter cannot read exact owned synthetic row");
 if((await list("recruiter",otherId)).length!==0)fail("recruiter can read another synthetic candidate");
 if(!exactOne(await list("admin",ownedId),ownedId)||!exactOne(await list("admin",otherId),otherId))
  fail("administrator cannot read both exact synthetic candidate fixtures");
 if((await list("pending",ownedId)).length!==0||(await list("pending",otherId)).length!==0)
  fail("pending account can read candidate data");
 checks+=6;
 const anonResponse=await http(base+"/rest/v1/candidates?"+query(ownedId),
  {method:"GET",headers:{apikey:key,Authorization:"Bearer "+key}});
 if(anonResponse.ok){
  const anonRows=await anonResponse.json();
  if(!Array.isArray(anonRows)||anonRows.length!==0)fail("anonymous candidate visibility");
 }
 checks++;
 // Never return UUIDs, emails, JWTs, raw records or passwords to CI logs.
 return {status:"PREFLIGHT_PASS_NOT_FORMAL_140_CASE_ACCEPTANCE",
  nonproduction_project_only:true,goTrueSessions:3,read_only_checks:checks};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runHostedReadOnlyPreflight({
  url:process.env.AMF_UAT_SUPABASE_URL,
  anonKey:process.env.AMF_UAT_ANON_KEY,
  adminEmail:process.env.AMF_UAT_ADMIN_EMAIL,
  adminPassword:process.env.AMF_UAT_ADMIN_PASSWORD,
  recruiterEmail:process.env.AMF_UAT_RECRUITER_EMAIL,
  recruiterPassword:process.env.AMF_UAT_RECRUITER_PASSWORD,
  pendingEmail:process.env.AMF_UAT_PENDING_EMAIL,
  pendingPassword:process.env.AMF_UAT_PENDING_PASSWORD,
  ownedCandidateId:process.env.AMF_UAT_OWNED_CANDIDATE_ID,
  otherCandidateId:process.env.AMF_UAT_OTHER_CANDIDATE_ID
 }).then(result=>process.stdout.write(JSON.stringify(result)+"\n"))
 .catch(error=>{
  // no raw error dump, since it could contain a provider response.
  process.stderr.write(String(error?.message||"Hosted acceptance preflight failed")+"\n");
  process.exitCode=1;
 });
}
