/**
 * Build64: run 135 historical read cases against pre-seeded, dedicated hosted UAT only.
 * NEVER executes 5 historical write cases; NEVER constitutes formal acceptance.
 * No response records, usernames, UUIDs, passwords or tokens are emitted.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {assertUnprivilegedUatKey} from "../build66/uat-key-gate.mjs";

const HOST="dhlhlasnaapzckjyvffn.supabase.co";
const fixtureAck="I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES";
const expectedTables=[
 "audit_logs","billing","candidate_activities","candidates","clients",
 "google_integrations","integrations","interviews","job_openings",
 "notifications","offers","profiles","submissions","sync_logs","user_roles"
];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
// Frozen Build41 case expectations. Fail closed if historical fixture source drifts.
const FROZEN_READ_COUNTS="111211122218218000100011101101000100011101101010000000001001000000000001001000000000001001000000000001001000000000001001000000000000000";
const FROZEN_SUBJECTS=[
 "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
 "11111111-1111-4111-8111-111111111111",
 "22222222-2222-4222-8222-222222222222",
 "33333333-3333-4333-8333-333333333333",
 "44444444-4444-4444-8444-444444444444",
 "55555555-5555-4555-8555-555555555555",
 "66666666-6666-4666-8666-666666666666",
 "77777777-7777-4777-8777-777777777777",
 "88888888-8888-4888-8888-888888888888"
];
const FIXTURE_PROFILES=[
 {role:"admin",status:"approved",active:true},
 {role:"recruiter",status:"approved",active:true},
 {role:"recruiter",status:"approved",active:true},
 {role:"finance",status:"approved",active:true},
 {role:"operations",status:"approved",active:true},
 {role:"recruiter",status:"pending",active:true},
 {role:"recruiter",status:"approved",active:false},
 {role:"viewer",status:"approved",active:true},
 {role:null,status:null,active:null}
];
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
 if(subjects.length!==9||subjects.some(x=>!uuid.test(x))||subjects.some((x,i)=>x!==FROZEN_SUBJECTS[i]))
  stop("historical subject identity fingerprint drift");
 if(JSON.stringify(tables)!==JSON.stringify(expectedTables))stop("unexpected table order");
 const pairs=new Set();
 for(let i=0;i<cases.length;i++){
  const c=cases[i];
  const caseId="B41-SIGNED-READ-"+String(i+1).padStart(3,"0");
  if(c.case_id!==caseId||!Number.isSafeInteger(c.expected)||c.expected!==Number(FROZEN_READ_COUNTS[i]))
   stop("invalid case ID or historical expected row count drift");
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
 assertUnprivilegedUatKey(key);
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
   (u.pathname.startsWith("/rest/v1/") && !(
     options.method==="GET"&&(
       u.search==="?select=id" ||
       (/^\?(?:select=id,status,is_active&id|select=user_id,role&user_id)=eq\.[0-9a-f-]{36}$/i).test(u.search)
     )
   )))
   stop("unexpected request method, path or host");
  try{return await http(url,{...options,redirect:"error",signal:AbortSignal.timeout(10000)});}
  catch{stop("hosted connection refused, timed out or redirected");}
 };
 const bearer=[];
 const ids=new Set();
 const hostedIds=[];
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
  hostedIds.push(user.id);
  bearer.push(session.access_token);
 }
 // Fixture integrity is separate from the 135 historical count tests.
 // The matrix depends on exact role/status combinations, including a pending,
 // inactive and missing-profile identity. A mis-seeded role cannot earn a pass.
 for(let i=0;i<9;i++){
  const fixture=FIXTURE_PROFILES[i];
  const headers={apikey:key,Authorization:"Bearer "+bearer[i],Accept:"application/json"};
  const requests=[
   ["profiles","select=id,status,is_active&id=eq."+hostedIds[i]],
   ["user_roles","select=user_id,role&user_id=eq."+hostedIds[i]]
  ];
  const result=[];
  for(const [table,query] of requests){
   const response=await call(origin+"/rest/v1/"+table+"?"+query,{method:"GET",headers});
   if(response.status!==200)stop("hosted fixture "+String(i+1)+" scope unavailable");
   const rows=await response.json().catch(()=>null);
   if(!Array.isArray(rows))stop("hosted fixture "+String(i+1)+" invalid response");
   result.push(rows);
  }
  const [profiles,roles]=result;
  if(fixture.role===null){
   if(profiles.length||roles.length)stop("unexpected profile or role for identity "+String(i+1));
  }else{
   if(profiles.length!==1||profiles[0]?.id!==hostedIds[i]||
      profiles[0]?.status!==fixture.status||profiles[0]?.is_active!==fixture.active||
      roles.length!==1||roles[0]?.user_id!==hostedIds[i]||roles[0]?.role!==fixture.role)
    stop("test identity fixture role/profile mismatch at slot "+String(i+1));
  }
 }
 const outcomes=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i],index=Math.floor(i/15);
  const response=await call(origin+"/rest/v1/"+c.table+"?select=id",{
   method:"GET",
   headers:{apikey:key,Authorization:"Bearer "+bearer[index],Accept:"application/json"}
  });
  let count=null;
  let exactCandidateOwnership=true;
  if(response.status===200){
   const rows=await response.json().catch(()=>null);
   if(Array.isArray(rows)){
    count=rows.length;
    // The source-shaped synthetic fixture sets recruiter A/B candidate IDs
    // to their GoTrue user IDs. Counting one visible row alone is insufficient:
    // an unauthorized recruiter's row could be returned instead.
    if(c.table==="candidates" && index<=2){
     const expectedIds=index===0?[hostedIds[1],hostedIds[2]]:[hostedIds[index]];
     const found=rows.map(row=>row?.id);
     exactCandidateOwnership=found.length===expectedIds.length &&
       new Set(found).size===expectedIds.length &&
       expectedIds.every(id=>found.includes(id));
    }
   }
  }
  const passed=response.status===200&&count===c.expected&&exactCandidateOwnership;
  outcomes.push({case_id:c.case_id,expected:c.expected,observed_count:count,
   response_status:response.status,pass:passed});
 }
 const passed=outcomes.filter(x=>x.pass).length;
 return {
  status:passed===135?"READ_ONLY_CASES_PASS_NOT_FORMAL_ACCEPTANCE":"READ_ONLY_CASES_FAILED_NOT_FORMAL_ACCEPTANCE",
  source:"security/build41/signed-http-135-read-matrix.json",
  host_restricted:true,session_count:9,fixture_integrity_checks:18,read_case_total:135,read_case_passed:passed,
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
