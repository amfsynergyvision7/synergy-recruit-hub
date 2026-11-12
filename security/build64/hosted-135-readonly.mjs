/**
 * Build64: run 135 historical read cases against pre-seeded, dedicated hosted UAT only.
 * NEVER executes 5 historical write cases; NEVER constitutes formal acceptance.
 * No response records, usernames, UUIDs, passwords or tokens are emitted.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const HOST="dhlhlasnaapzckjyvffn.supabase.co";
const fixtureAck="I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES";
const expectedTables=[
 "audit_logs","billing","candidate_activities","candidates","clients",
 "google_integrations","integrations","interviews","job_openings",
 "notifications","offers","profiles","submissions","sync_logs","user_roles"
];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const matrix=JSON.parse(readFileSync("security/build41/signed-http-135-read-matrix.json","utf8"));
const stop=(message)=>{throw new Error("Hosted 135-case UAT STOP: "+message);};
const mandatory=(v,label)=>{
 if(typeof v!=="string"||!v.trim())stop("missing "+label);
 return v.trim();
};
export function validateReadMatrix(input=matrix){
 const cases=input?.read_cases;
 if(!Array.isArray(cases)||cases.length!==135)stop("expected 135 read cases");
 const subjects=[...new Set(cases.map(c=>c.sub))];
 const tables=[...new Set(cases.map(c=>c.table))];
 if(subjects.length!==9||subjects.some(x=>!uuid.test(x)))stop("expected nine distinct synthetic subjects");
 if(JSON.stringify(tables)!==JSON.stringify(expectedTables))stop("unexpected table order");
 const pairs=new Set();
 for(let i=0;i<cases.length;i++){
  const c=cases[i];
  const caseId="B41-SIGNED-READ-"+String(i+1).padStart(3,"0");
  if(c.case_id!==caseId||!Number.isSafeInteger(c.expected)||c.expected<0||c.expected>100)
   stop("invalid case ID or expected row count");
  const pair=c.sub+"|"+c.table;
  if(pairs.has(pair))stop("duplicate subject/table pair");
  pairs.add(pair);
  if(c.sub!==subjects[Math.floor(i/15)]||c.table!==expectedTables[i%15])
   stop("case coverage order drift");
 }
 if(pairs.size!==135)stop("matrix coverage incomplete");
 return {subjects,tables,cases};
}
export async function runHostedReadOnlyMatrix(config,http=fetch,input=matrix){
 const {subjects,cases}=validateReadMatrix(input);
 const raw=mandatory(config?.url,"AMF_UAT_SUPABASE_URL");
 let origin;
 try{
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.hostname!==HOST||u.pathname!=="/"||
     u.search||u.hash||u.username||u.password||u.port)stop("only the dedicated nonproduction host is allowed");
  origin=u.origin;
 }catch{stop("invalid or unauthorized nonproduction host");}
 const key=mandatory(config?.anonKey,"AMF_UAT_ANON_KEY");
 if(config?.fixtureAck!==fixtureAck)stop("pre-seeded synthetic hosted fixture acknowledgment required");
 const creds=Array.from({length:9},(_,i)=>{
  const idx=String(i+1).padStart(2,"0");
  return {
   email:mandatory(config?.credentials?.[i]?.email,"AMF_UAT_CASE_"+idx+"_EMAIL").toLowerCase(),
   password:mandatory(config?.credentials?.[i]?.password,"AMF_UAT_CASE_"+idx+"_PASSWORD")
  };
 });
 if(new Set(creds.map(c=>c.email)).size!==9)stop("test email identities must be distinct");
 const allowed=new Set(["/auth/v1/token","/auth/v1/user",...expectedTables.map(x=>"/rest/v1/"+x)]);
 const call=async(url,options)=>{
  const u=new URL(url);
  if(u.origin!==origin||!allowed.has(u.pathname)||u.hash||u.username||u.password||
   (u.pathname==="/auth/v1/token" && !(options.method==="POST"&&u.search==="?grant_type=password"))||
   (u.pathname==="/auth/v1/user" && !(options.method==="GET"&&u.search===""))||
   (u.pathname.startsWith("/rest/v1/") && !(options.method==="GET"&&u.search==="?select=id")))
   stop("unexpected request method, path or host");
  return http(url,{...options,redirect:"error",signal:AbortSignal.timeout(10000)});
 };
 const bearer=[];
 const ids=new Set();
 for(let i=0;i<9;i++){
  const response=await call(origin+"/auth/v1/token?grant_type=password",{
   method:"POST",headers:{apikey:key,"Content-Type":"application/json"},
   body:JSON.stringify(creds[i])
  });
  if(!response.ok)stop("nonproduction GoTrue password login not available for fixture "+String(i+1));
  const session=await response.json().catch(()=>stop("malformed GoTrue login"));
  if(typeof session?.access_token!=="string"||!uuid.test(session?.user?.id))
   stop("GoTrue session integrity missing");
  const userResponse=await call(origin+"/auth/v1/user",{
   method:"GET",headers:{apikey:key,Authorization:"Bearer "+session.access_token}
  });
  if(!userResponse.ok)stop("GoTrue subject verification failed");
  const user=await userResponse.json().catch(()=>stop("malformed GoTrue subject"));
  if(user?.id!==session.user.id||ids.has(user.id))stop("GoTrue subject mismatch or reused identity");
  ids.add(user.id);
  bearer.push(session.access_token);
 }
 const outcomes=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i],index=Math.floor(i/15);
  const response=await call(origin+"/rest/v1/"+c.table+"?select=id",{
   method:"GET",
   headers:{apikey:key,Authorization:"Bearer "+bearer[index],Accept:"application/json"}
  });
  let count=null;
  if(response.status===200){
   const rows=await response.json().catch(()=>null);
   if(Array.isArray(rows))count=rows.length;
  }
  const passed=response.status===200&&count===c.expected;
  outcomes.push({case_id:c.case_id,expected:c.expected,observed_count:count,
   response_status:response.status,pass:passed});
 }
 const passed=outcomes.filter(x=>x.pass).length;
 return {
  status:passed===135?"READ_ONLY_CASES_PASS_NOT_FORMAL_ACCEPTANCE":"READ_ONLY_CASES_FAILED_NOT_FORMAL_ACCEPTANCE",
  source:"security/build41/signed-http-135-read-matrix.json",
  host_restricted:true,session_count:9,read_case_total:135,read_case_passed:passed,
  read_case_failed:135-passed,write_cases_executed:0,write_cases_deferred:5,
  formally_accepted_cases:0,case_results:outcomes
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config={
  url:process.env.AMF_UAT_SUPABASE_URL,
  anonKey:process.env.AMF_UAT_ANON_KEY,
  fixtureAck:process.env.AMF_UAT_SYNTHETIC_135_FIXTURE_ACK,
  credentials:Array.from({length:9},(_,i)=>{
   const p="AMF_UAT_CASE_"+String(i+1).padStart(2,"0");
   return {email:process.env[p+"_EMAIL"],password:process.env[p+"_PASSWORD"]};
  })
 };
 runHostedReadOnlyMatrix(config).then(result=>{
  process.stdout.write(JSON.stringify(result)+"\n");
  if(result.read_case_failed)process.exitCode=1;
 }).catch(error=>{
  // Safe errors are controlled/constant; never dump provider responses or credentials.
  process.stderr.write(String(error?.message||"Hosted UAT unavailable")+"\n");
  process.exitCode=1;
 });
}
