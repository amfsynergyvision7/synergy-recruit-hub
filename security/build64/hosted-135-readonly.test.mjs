import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runHostedReadOnlyMatrix,validateReadMatrix} from "./hosted-135-readonly.mjs";

const source=JSON.parse(readFileSync("security/build41/signed-http-135-read-matrix.json","utf8"));
const {subjects,cases,tables}=validateReadMatrix();
const config={
 url:"https://dhlhlasnaapzckjyvffn.supabase.co/",
 anonKey:"offline-test-publishable-key-no-secret",
 fixtureAck:"I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES",
 credentials:subjects.map((_,i)=>({
  email:"synthetic-"+String(i+1)+"@example.invalid",password:"invented-password-only"
 }))
};
const fake=(options={})=>{
 const calls=[];
 async function http(url,init){
  const u=new URL(url);
  calls.push({path:u.pathname,method:init.method,redirect:init.redirect});
  assert.equal(u.origin,"https://dhlhlasnaapzckjyvffn.supabase.co");
  assert.equal(init.redirect,"error");
  assert.ok(["GET","POST"].includes(init.method));
  if(u.pathname==="/auth/v1/token"){
   assert.equal(init.method,"POST");
   const p=JSON.parse(init.body),idx=config.credentials.findIndex(x=>x.email===p.email);
   if(idx<0)throw Error("unrecognized synthetic fixture");
   return {ok:true,status:200,json:async()=>({
     access_token:"sim-token-"+idx,user:{id:subjects[idx]}
   })};
  }
  if(u.pathname==="/auth/v1/user"){
   const idx=Number(init.headers.Authorization.replace("Bearer sim-token-",""));
   return {ok:true,status:200,json:async()=>({id:subjects[idx]})};
  }
  const table=u.pathname.replace("/rest/v1/","");
  const idx=Number(init.headers.Authorization.replace("Bearer sim-token-",""));
  assert.ok(tables.includes(table));
  assert.equal(init.method,"GET");
  assert.equal(u.search,"?select=id");
  const entry=cases[idx*15+tables.indexOf(table)];
  if(!entry)throw Error("unexpected case");
  const status=(options.badStatus && options.badStatus.case_id===entry.case_id)?
    options.badStatus.status:200;
  const count=(options.badCount===entry.case_id)?entry.expected+1:entry.expected;
  const body=options.malformed===entry.case_id?{bad:"shape"}:
    Array.from({length:count},()=>({id:"synthetic-row-never-exported"}));
  return {ok:status===200,status,json:async()=>body};
 }
 return {calls,http};
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
 assert.equal(result.read_case_passed,135);
 assert.equal(result.read_case_failed,0);
 assert.equal(result.formally_accepted_cases,0);
 assert.equal(result.write_cases_executed,0);
 assert.equal(result.write_cases_deferred,5);
 assert.equal(calls.length,153);
 assert.ok(calls.every(c=>c.redirect==="error"));
 assert.equal(calls.filter(c=>c.method==="POST").length,9);
 assert.equal(calls.filter(c=>c.method==="GET").length,144);
 const serialized=JSON.stringify(result);
 assert.doesNotMatch(serialized,/sim-token|@example\.invalid|synthetic-row-never-exported/);
 for(const subject of subjects)assert.ok(!serialized.includes(subject));
});
test("wrong row counts, missing table and malformed responses are failed cases, never accepted",async()=>{
 for(const condition of [
  {badCount:"B41-SIGNED-READ-017"},
  {badStatus:{case_id:"B41-SIGNED-READ-023",status:404}},
  {badStatus:{case_id:"B41-SIGNED-READ-024",status:500}},
  {malformed:"B41-SIGNED-READ-031"}
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
 await assert.rejects(runHostedReadOnlyMatrix({...config,credentials:config.credentials.map((x,i)=>i===1?config.credentials[0]:x)},never),/distinct/);
 const duplicated=structuredClone(source);
 duplicated.read_cases[3].table=duplicated.read_cases[2].table;
 await assert.rejects(runHostedReadOnlyMatrix(config,never,duplicated),/duplicate|coverage|order/);
 const altered=structuredClone(source);
 altered.read_cases[0].case_id="B41-UNAPPROVED-000";
 await assert.rejects(runHostedReadOnlyMatrix(config,never,altered),/invalid case ID/);
 assert.equal(calls,0);
});
test("same GoTrue identity across two fixtures blocks the runner before row reads",async()=>{
 const {http:original}=fake();
 await assert.rejects(runHostedReadOnlyMatrix(config,async(url,opts)=>{
  const o=await original(url,opts),u=new URL(url);
  if(u.pathname==="/auth/v1/user" && opts.headers.Authorization==="Bearer sim-token-1")
   return {ok:true,status:200,json:async()=>({id:subjects[0]})};
  return o;
 }),/subject mismatch or reused identity/);
});
