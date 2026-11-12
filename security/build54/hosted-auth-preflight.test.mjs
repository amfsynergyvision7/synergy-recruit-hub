import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runHostedReadOnlyPreflight} from "./hosted-auth-preflight.mjs";
const src=readFileSync("security/build54/hosted-auth-preflight.mjs","utf8");
const UUID=["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"];
const users={admin:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
 recruiter:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 pending:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"};
const conf={
 url:"https://dhlhlasnaapzckjyvffn.supabase.co/",
 anonKey:"synthetic-nonsecret",
 adminEmail:"synthetic-admin@example.invalid",adminPassword:"dummy-pass",
 recruiterEmail:"synthetic-recruiter@example.invalid",recruiterPassword:"dummy-pass",
 pendingEmail:"synthetic-pending@example.invalid",pendingPassword:"dummy-pass",
 ownedCandidateId:UUID[0],otherCandidateId:UUID[1]
};
test("preflight cannot connect to production host or accidentally inspect user records",async()=>{
 let called=0;
 await assert.rejects(runHostedReadOnlyPreflight({...conf,url:"https://wusntntcqgtpgokggdzv.supabase.co/"},async()=>{called++;}),/only the dedicated nonproduction/);
 assert.equal(called,0);
 await assert.rejects(runHostedReadOnlyPreflight({...conf,anonKey:""},async()=>{called++;}),/Missing AMF_UAT_ANON_KEY/);
 await assert.rejects(runHostedReadOnlyPreflight({...conf,otherCandidateId:UUID[0]},async()=>{called++;}),/two distinct synthetic UUID/);
 await assert.rejects(runHostedReadOnlyPreflight({...conf,recruiterEmail:conf.adminEmail},async()=>{called++;}),/test users must be distinct/);
 assert.equal(called,0);
});
function fetchStub(misconfigured=false){
 return async (url,opts)=>{
  const parsed=new URL(url);
  if(!["GET","POST"].includes(opts.method))throw Error("write method not permitted");
  const uid=Object.keys(users).find(x=>url.includes(x));
  let result;
  if(parsed.pathname==="/auth/v1/token"){
   const payload=JSON.parse(opts.body);
   const label=Object.keys(users).find(x=>payload.email.includes(x));
   result={access_token:"simulated-token-"+label,user:{id:users[label]}};
  }else if(parsed.pathname==="/auth/v1/user"){
   const label=opts.headers.Authorization.split("simulated-token-")[1];
   result={id:users[label]};
  }else if(parsed.pathname==="/rest/v1/profiles"){
   const id=parsed.searchParams.get("id").replace("eq.","");
   const label=Object.keys(users).find(x=>users[x]===id);
   result=[{id,status:label==="pending"?"pending":"approved",is_active:label!=="pending"}];
  }else if(parsed.pathname==="/rest/v1/user_roles"){
   const id=parsed.searchParams.get("user_id").replace("eq.","");
   const label=Object.keys(users).find(x=>users[x]===id);
   result=label==="pending"?[]:[{role:label}];
  }else if(parsed.pathname==="/rest/v1/candidates"){
   const id=parsed.searchParams.get("id").replace("eq.","");
   const label=opts.headers.Authorization?.split("simulated-token-")[1]||"anon";
   const allowed=label==="admin"||(label==="recruiter"&&id===UUID[0]);
   result=allowed?[{id}]:[];
   if(misconfigured&&label==="recruiter"&&id===UUID[1])result=[{id}];
  }else throw Error("Unexpected route "+parsed.pathname);
  return {ok:true,status:200,json:async()=>result};
 };
}
test("simulated 3-user preflight tests scopes and returns counts only",async()=>{
 const result=await runHostedReadOnlyPreflight(conf,fetchStub());
 assert.deepEqual(result,{status:"PREFLIGHT_PASS_NOT_FORMAL_140_CASE_ACCEPTANCE",
 nonproduction_project_only:true,goTrueSessions:3,read_only_checks:19});
 assert.ok(!JSON.stringify(result).includes("example.invalid"));
 assert.ok(!JSON.stringify(result).includes(UUID[0]));
});
test("cross-recruiter visibility blocks the hosted acceptance preflight",async()=>{
 await assert.rejects(runHostedReadOnlyPreflight(conf,fetchStub(true)),
   /recruiter can read another synthetic candidate/);
});
test("source contract has no table writes, service key or log of secrets",()=>{
 assert.doesNotMatch(src,/service_role|service_key|serviceKey|supabase_service_role/i);
 assert.doesNotMatch(src,/\/rest\/v1\/[a-z_]+\?[^\n]*\b(?:insert|update|delete)/i);
 assert.match(src,/method:"GET"/);
 assert.match(src,/dedicated nonproduction Supabase project/);
});

test("wrong profile row, wrong candidate ID and unexpected recruiter admin role all fail closed",async()=>{
 for(const scenario of ["profile","candidate","privilege"]){
  const base=fetchStub();
  const tampered=async(url,opts)=>{
   const response=await base(url,opts);
   const parsed=new URL(url);
   const original=await response.json();
   let result=original;
   if(scenario==="profile" && parsed.pathname==="/rest/v1/profiles" &&
      parsed.searchParams.get("id")==="eq."+users.admin)
     result=[{...original[0],id:users.pending}];
   if(scenario==="candidate" && parsed.pathname==="/rest/v1/candidates" &&
      opts.headers.Authorization==="Bearer simulated-token-recruiter" &&
      parsed.searchParams.get("id")==="eq."+UUID[0])
     result=[{id:UUID[1]}];
   if(scenario==="privilege" && parsed.pathname==="/rest/v1/user_roles" &&
      parsed.searchParams.get("user_id")==="eq."+users.recruiter)
     result=[{role:"recruiter"},{role:"admin"}];
   return {...response,json:async()=>result};
  };
  await assert.rejects(runHostedReadOnlyPreflight(conf,tampered),
   /exact scoped self-profile|exact owned synthetic row|admin privilege/);
 }
});

test("all credential-bearing hosted calls prohibit redirects and use approved read-only routes",async()=>{
 const requests=[];
 const original=fetchStub();
 const result=await runHostedReadOnlyPreflight(conf,async(url,opts)=>{
  requests.push({url,method:opts.method,redirect:opts.redirect});
  return original(url,opts);
 });
 assert.equal(result.read_only_checks,19);
 assert.ok(requests.length>0);
 for(const req of requests){
  const u=new URL(req.url);
  assert.equal(u.origin,"https://dhlhlasnaapzckjyvffn.supabase.co");
  assert.equal(req.redirect,"error");
  assert.ok(["/auth/v1/token","/auth/v1/user","/rest/v1/profiles",
   "/rest/v1/user_roles","/rest/v1/candidates"].includes(u.pathname));
  assert.equal(req.method,u.pathname==="/auth/v1/token"?"POST":"GET");
 }
});
test("malformed anonymous response cannot count as safe denial",async()=>{
 const base=fetchStub();
 const corrupt=async(url,opts)=>{
  const response=await base(url,opts);
  if(new URL(url).pathname==="/rest/v1/candidates" &&
     opts.headers.Authorization==="Bearer "+conf.anonKey)
    return {...response,json:async()=>({unexpected:"not-an-array"})};
  return response;
 };
 await assert.rejects(runHostedReadOnlyPreflight(conf,corrupt),
  /anonymous candidate visibility/);
});

test("anonymous denial is accepted only as empty 200 or explicit 401/403",async()=>{
 const original=fetchStub();
 for(const status of [401,403,404,500]){
  const overridden=async(url,opts)=>{
   if(new URL(url).pathname==="/rest/v1/candidates" &&
      opts.headers.Authorization==="Bearer "+conf.anonKey)
    return {ok:false,status,json:async()=>({code:"synthetic"})};
   return original(url,opts);
  };
  if(status===401||status===403){
   const result=await runHostedReadOnlyPreflight(conf,overridden);
   assert.equal(result.read_only_checks,19);
  }else{
   await assert.rejects(runHostedReadOnlyPreflight(conf,overridden),
    /anonymous candidate check unavailable HTTP/);
  }
 }
});
test("preflight source never bypasses the redirect-safe transport wrapper",()=>{
 const directCalls=[...src.matchAll(/\bhttp\s*\(/g)];
 assert.equal(directCalls.length,1,"only the safeHttp wrapper may call injected http directly");
 assert.match(src,/const response=await jsonResponse\(await safeHttp\(/);
 assert.match(src,/redirect:"error"/);
});
