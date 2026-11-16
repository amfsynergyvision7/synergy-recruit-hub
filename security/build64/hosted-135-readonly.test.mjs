import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runHostedReadOnlyMatrix,validateReadMatrix} from "./hosted-135-readonly.mjs";

const source=JSON.parse(readFileSync("security/build41/signed-http-135-read-matrix.json","utf8"));
const {subjects,cases,tables}=validateReadMatrix();
const config={
 url:"https://dhlhlasnaapzckjyvffn.supabase.co/",
 anonKey:"sb_publishable_offline_synthetic_only",
 fixtureAck:"I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES",
 credentials:subjects.map((_,i)=>({
  email:"synthetic-"+String(i+1)+"@example.invalid",password:"invented-password-only"
 })),
 expectedHostedUserIds:subjects
};
const fake=(options={})=>{
 const calls=[];
 const tokens=subjects.map((subject,i)=>{
  const claims={role:options.badTokenRole===i?"service_role":"authenticated",
   sub:options.badTokenSub===i?subjects[(i+1)%9]:subject,
   exp:Math.floor(Date.now()/1000)+(options.expiredToken===i?-50:3600)};
  return ["synthetic",Buffer.from(JSON.stringify(claims)).toString("base64url"),"test-signature-"+i].join(".");
 });
 async function http(url,init){
  const u=new URL(url);
  calls.push({path:u.pathname,method:init.method,redirect:init.redirect});
  assert.equal(u.origin,"https://dhlhlasnaapzckjyvffn.supabase.co");
  assert.equal(init.redirect,"error");
  assert.ok(["GET","HEAD","POST"].includes(init.method));
  if(u.pathname==="/auth/v1/token"){
   assert.equal(init.method,"POST");
   const p=JSON.parse(init.body),idx=config.credentials.findIndex(x=>x.email===p.email);
   if(idx<0)throw Error("unrecognized synthetic fixture");
   return {ok:true,status:200,json:async()=>({
     access_token:options.badTokenStructure===idx?"malformed-token":
       tokens[options.wrongPinnedSubject===idx?(idx+1)%9:idx],
     user:{id:subjects[options.wrongPinnedSubject===idx?(idx+1)%9:idx]}
   })};
  }
  if(u.pathname==="/auth/v1/user"){
   const idx=tokens.indexOf(init.headers.Authorization.slice("Bearer ".length));
   assert.ok(idx>=0,"expected only inventoried synthetic subject JWTs");
   return {ok:true,status:200,json:async()=>({id:subjects[idx]})};
  }
  const table=u.pathname.replace("/rest/v1/","");
  const idx=tokens.indexOf(init.headers.Authorization.slice("Bearer ".length));
   assert.ok(idx>=0,"expected only inventoried synthetic subject JWTs");
  assert.ok(tables.includes(table));
  if(u.search.startsWith("?select=id,status,is_active&id=eq.")){
   assert.equal(table,"profiles");
   const profile=idx===8?[]:[{id:subjects[idx],
     status:idx===5?"pending":"approved",is_active:idx!==6}];
   if(options.badProfileStatus===idx&&profile.length)profile[0].status="rejected";
   if(options.badProfileOwner===idx&&profile.length)profile[0].id=subjects[(idx+1)%9];
   return {ok:true,status:200,json:async()=>profile};
  }
  if(u.search.startsWith("?select=user_id,role&user_id=eq.")){
   assert.equal(table,"user_roles");
   const slotRoles=["admin","recruiter","recruiter","finance","operations",
    "recruiter","recruiter","viewer",null];
   const rows=idx===8?[]:[{user_id:subjects[idx],role:slotRoles[idx]}];
   if(options.badRole===idx&&rows.length)rows[0].role="admin";
   if(options.badRoleOwner===idx&&rows.length)rows[0].user_id=subjects[(idx+1)%9];
   return {ok:true,status:200,json:async()=>rows};
  }
  const candidateIds=table==="candidates"&&idx<=2;
  assert.equal(init.method,candidateIds?"GET":"HEAD");
  if(!candidateIds)assert.equal(init.headers.Prefer,"count=exact");
  assert.equal(u.search,"?select=id");
  const entry=cases[idx*15+tables.indexOf(table)];
  if(!entry)throw Error("unexpected case");
  const status=(options.badStatus && options.badStatus.case_id===entry.case_id)?
    options.badStatus.status:200;
  const count=(options.badCount===entry.case_id)?entry.expected+1:entry.expected;
  if(!candidateIds){
   const range=options.malformed===entry.case_id?"invalid":
     count===0?"*/0":"0-"+(Math.min(count,1000)-1)+"/"+count;
   return {ok:status===200,status,headers:{get:key=>key==="content-range"&&status===200?range:null},
    json:async()=>{throw Error("HEAD data body must never be parsed")}};
  }
  let body=Array.from({length:count},()=>({id:"synthetic-row-never-exported"}));
  if(count===entry.expected){
   const expectedIds=idx===0?[subjects[1],subjects[2]]:[subjects[idx]];
   body=expectedIds.map(id=>({id}));
  }
  if(options.badCandidateId===entry.case_id && body.length>0){
   body[0]={id:subjects[4]};
  }
  if(options.malformed===entry.case_id)body={bad:"shape"};
  return {ok:status===200,status,json:async()=>body};
 }
 return {calls,http,tokens};
};
test("matrix is exactly nine subject roles by fifteen named tables, 135 unique read IDs",()=>{
 assert.equal(subjects.length,9);
 assert.equal(tables.length,15);
 assert.equal(cases.length,135);
 assert.equal(new Set(cases.map(x=>x.case_id)).size,135);
 assert.equal(cases[134].case_id,"B41-SIGNED-READ-135");
});
test("full nine-user hosted read suite returns 135 anonymous-safe case outcomes with zero write cases",async()=>{
 const {http,calls}=fake();
 const result=await runHostedReadOnlyMatrix(config,http);
 assert.equal(result.fixture_integrity_checks,18);
 assert.equal(result.read_case_passed,135);
 assert.equal(result.read_case_failed,0);
 assert.equal(result.formally_accepted_cases,0);
 assert.equal(result.write_cases_executed,0);
 assert.equal(result.write_cases_deferred,5);
 assert.equal(calls.length,171);
 assert.ok(calls.every(c=>c.redirect==="error"));
 assert.equal(calls.filter(c=>c.method==="POST").length,9);
 assert.equal(calls.filter(c=>c.method==="GET").length,30);
 assert.equal(calls.filter(c=>c.method==="HEAD").length,132);
 const serialized=JSON.stringify(result);
 assert.doesNotMatch(serialized,/sim-token|@example\.invalid|synthetic-row-never-exported/);
 for(const subject of subjects)assert.ok(!serialized.includes(subject));
});
test("wrong row counts, missing table and malformed responses are failed cases, never accepted",async()=>{
 for(const condition of [
  {badCount:"B41-SIGNED-READ-017"},
  {badStatus:{case_id:"B41-SIGNED-READ-023",status:404}},
  {badStatus:{case_id:"B41-SIGNED-READ-024",status:500}},
  {malformed:"B41-SIGNED-READ-031"},
  {badCandidateId:"B41-SIGNED-READ-019"}
 ]){
  const {http}=fake(condition);
  const result=await runHostedReadOnlyMatrix(config,http);
  assert.equal(result.read_case_passed,134);
  assert.equal(result.read_case_failed,1);
  assert.equal(result.formally_accepted_cases,0);
  assert.match(result.status,/FAILED_NOT_FORMAL/);
 }
});
test("production endpoint, missing fixture ACK, duplicate login and malformed matrix fail BEFORE HTTP",async()=>{
 let calls=0;
 const never=async()=>{calls++;throw Error("should not be dispatched")};
 await assert.rejects(runHostedReadOnlyMatrix({...config,url:"https://wusntntcqgtpgokggdzv.supabase.co/"},never),/host/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,fixtureAck:""},never),/acknowledgment/);
 const legacyKey=(role)=>["synthetic",Buffer.from(JSON.stringify({role})).toString("base64url"),"synthetic"].join(".");
 await assert.rejects(runHostedReadOnlyMatrix({...config,anonKey:"sb_secret_never_accepted"},never),/privileged UAT API key/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,anonKey:legacyKey("service_role")},never),/non-anonymous JWT API key/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,anonKey:"unexpected-key"},never),/unrecognized nonproduction publishable key/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,credentials:config.credentials.map((x,i)=>i===1?config.credentials[0]:x)},never),/distinct/);
 const duplicated=structuredClone(source);
 duplicated.read_cases[3].table=duplicated.read_cases[2].table;
 await assert.rejects(runHostedReadOnlyMatrix(config,never,duplicated),/duplicate|coverage|order/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,expectedHostedUserIds:null},never),
  /nine distinct approved hosted fixture UUID mappings/);
 await assert.rejects(runHostedReadOnlyMatrix({...config,expectedHostedUserIds:[...subjects.slice(0,8),subjects[0]]},never),
  /nine distinct approved hosted fixture UUID mappings/);
 const altered=structuredClone(source);
 altered.read_cases[0].case_id="B41-UNAPPROVED-000";
 await assert.rejects(runHostedReadOnlyMatrix(config,never,altered),/invalid case ID/);
 const tamperedExpected=structuredClone(source);
 tamperedExpected.read_cases[12].expected=7;
 await assert.rejects(runHostedReadOnlyMatrix(config,never,tamperedExpected),/expected row count drift/);
 const tamperedSubject=structuredClone(source);
 tamperedSubject.read_cases.filter(x=>x.sub===subjects[4]).forEach(x=>x.sub="99999999-9999-4999-8999-999999999999");
 await assert.rejects(runHostedReadOnlyMatrix(config,never,tamperedSubject),/subject identity fingerprint drift/);
 assert.equal(calls,0);
});
test("same GoTrue identity across two fixtures blocks the runner before row reads",async()=>{
 const {http:original,tokens}=fake();
 await assert.rejects(runHostedReadOnlyMatrix(config,async(url,opts)=>{
  const o=await original(url,opts),u=new URL(url);
  if(u.pathname==="/auth/v1/user" && opts.headers.Authorization==="Bearer "+tokens[1])
   return {ok:true,status:200,json:async()=>({id:subjects[0]})};
  return o;
 }),/subject mismatch or reused identity/);
});

test("hosted role/status ownership fixtures reject false-positive read-count configurations",async()=>{
 for(const setting of [
  {badProfileStatus:5},{badProfileOwner:2},{badRole:3},{badRoleOwner:4}
 ]){
  const {http}=fake(setting);
  await assert.rejects(runHostedReadOnlyMatrix(config,http),/test identity fixture role\/profile mismatch/);
 }
});

test("legacy anon JWT API key is permitted for synthetic hosted role checks only",async()=>{
 const key=["synthetic",Buffer.from(JSON.stringify({role:"anon"})).toString("base64url"),"synthetic"].join(".");
 const {http}=fake();
 const result=await runHostedReadOnlyMatrix({...config,anonKey:key},http);
 assert.equal(result.read_case_passed,135);
 assert.equal(result.formally_accepted_cases,0);
});

test("hosted GoTrue token claims must be signed-user shaped, current and exact-subject",async()=>{
 for(const failure of [
  {badTokenRole:2},{badTokenSub:1},{expiredToken:3},{badTokenStructure:4}
 ]){
  const {http}=fake(failure);
  await assert.rejects(runHostedReadOnlyMatrix(config,http),
   /hosted JWT role, subject or expiry mismatch|invalid hosted JWT structure/);
 }
});

test("a valid GoTrue session for the wrong historical slot cannot pass",async()=>{
 const {http}=fake({wrongPinnedSubject:0});
 await assert.rejects(runHostedReadOnlyMatrix(config,http),
  /GoTrue user UUID does not match approved hosted fixture slot/);
});

test("signed historical matrix fails closed on missing exact-count HEAD metadata",async()=>{
 const {http,calls}=fake({malformed:"B41-SIGNED-READ-002"});
 const result=await runHostedReadOnlyMatrix(config,http);
 assert.equal(result.read_case_failed,1);
 assert.equal(result.case_results.find(x=>x.case_id==="B41-SIGNED-READ-002")?.observed_count,null);
 assert.equal(calls.filter(x=>x.method==="HEAD").length,132);
});

test("approved hosted fixture UUID mapping refuses a different signed-in user",async()=>{
 const altered=[...subjects];altered[0]="99999999-9999-4999-8999-999999999999";
 const {http}=fake();
 await assert.rejects(runHostedReadOnlyMatrix({...config,expectedHostedUserIds:altered},http),
  /GoTrue user UUID does not match approved hosted fixture slot/);
});
