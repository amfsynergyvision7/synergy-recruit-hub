import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CONTROL_SURFACES,parseExactRange,runHostedPositiveControls,
 runCrosscheckedHostedSurface} from "./hosted-positive-controls.mjs";
import {PRIVATE_BRANDING_COLUMNS,PUBLIC_BRANDING_COLUMNS}
 from "../build66/hosted-anon-extra-scope.mjs";

const user="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const token=["invented-header",Buffer.from(JSON.stringify({
 role:"authenticated",sub:user,exp:Math.floor(Date.now()/1000)+3600
})).toString("base64url"),"invented-signature"].join(".");
const config={
 url:"https://dhlhlasnaapzckjyvffn.supabase.co/",
 anonKey:"sb_publishable_invented_only",
 fixtureAck:"I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES",
 admin:{email:"only-invented-admin@example.invalid",password:"invented-only-password",
  expectedUserId:user}
};
function fake(o={}){
 const calls=[];
 async function http(path,options){
  const url=new URL(path);
  calls.push({path:url.pathname,query:url.search,method:options.method,
   authed:!!options.headers.Authorization});
  assert.equal(url.origin,"https://dhlhlasnaapzckjyvffn.supabase.co");
  assert.equal(options.redirect,"error");
  assert.equal(options.headers.apikey,config.anonKey);
  if(url.pathname==="/auth/v1/token"){
   assert.equal(options.method,"POST");
   assert.equal(JSON.parse(options.body).email,config.admin.email);
   return {ok:true,status:200,json:async()=>({
    access_token:token,user:{id:o.badSessionId?"11111111-1111-4111-8111-111111111111":user}
   })};
  }
  if(url.pathname==="/auth/v1/user"){
   assert.equal(options.method,"GET");
   return {status:o.badUserStatus?401:200,
    json:async()=>({id:o.badUserId?"11111111-1111-4111-8111-111111111111":user})};
  }
  if(url.pathname==="/rest/v1/profiles"){
   assert.equal(options.method,"GET");
   return {status:200,json:async()=>[{
    id:user,status:o.badProfile?"pending":"approved",is_active:true
   }]};
  }
  if(url.pathname==="/rest/v1/user_roles"){
   assert.equal(options.method,"GET");
   return {status:200,json:async()=>[{
    user_id:user,role:o.badRole?"recruiter":"admin"
   }]};
  }
  assert.equal(options.method,"HEAD");
  assert.equal(options.headers.Prefer,"count=exact");
  const obj=url.pathname.replace("/rest/v1/","");
  const authed=!!options.headers.Authorization;
  let count=0,status=200;
  if(authed){
   assert.ok(CONTROL_SURFACES.includes(obj));
   count=o.emptyAdmin===obj?0:1;
   if(o.badAdminStatus===obj)status=403;
  }else if(obj==="app_settings"){
   const projection=url.searchParams.get("select");
   if(projection===PUBLIC_BRANDING_COLUMNS.join(","))count=1;
   else if(PRIVATE_BRANDING_COLUMNS.includes(projection))status=403;
   else throw Error("Unexpected branding field");
  }else{
   assert.ok(CONTROL_SURFACES.includes(obj));
   if(o.leakedAnon===obj)count=1;
  }
  if(o.missingAdmin===obj&&authed)status=404;
  const range=o.malformedAdmin===obj&&authed?"bogus":
   count===0?"*/0":"0-0/"+count;
  return {status,
   headers:{get:k=>k==="content-range"&&status===200?range:null},
   json:async()=>{throw Error("HEAD must not inspect data")},
   text:async()=>{throw Error("HEAD must not inspect data")}
  };
 }
 return {calls,http};
}
test("16 positive controls cover exactly three tables and thirteen views",()=>{
 const gap=JSON.parse(readFileSync("security/build65/production-hosted-coverage.json","utf8"));
 assert.equal(CONTROL_SURFACES.length,16);
 assert.equal(new Set(CONTROL_SURFACES).size,16);
 assert.deepEqual(CONTROL_SURFACES.slice(0,3),gap.uncovered_production_tables.slice(1));
 assert.deepEqual(CONTROL_SURFACES.slice(3),gap.uncovered_production_views);
});
test("exact HEAD count parser fails closed on malformed, overflow and missing",()=>{
 for(const [raw,count] of [["*/0",0],["0-0/1",1],["0-0/150",150]]){
  assert.equal(parseExactRange(raw),count);
 }
 for(const raw of [undefined,null,"", "*/","junk","0-1/*","0-0/-1",
  "*/9007199254740992","0-0/1; extra"]){
  assert.equal(parseExactRange(raw),null, String(raw));
 }
});
test("admin positive 16 and anonymous 20 probes crosscheck without reading business rows",async()=>{
 const {calls,http}=fake();
 const report=await runCrosscheckedHostedSurface(config,http);
 assert.equal(report.status,"CROSSCHECK_PROVISIONAL_PASS_NOT_RELEASE");
 assert.equal(report.positive.checks,16);
 assert.equal(report.positive.passed,16);
 assert.equal(report.anonymous.checks,20);
 assert.equal(report.anonymous.passed,20);
 assert.equal(report.formal_hosted_acceptance,0);
 assert.equal(calls.length,40);
 assert.equal(calls.filter(x=>x.method==="HEAD").length,36);
 assert.equal(calls.filter(x=>x.method==="GET").length,3);
 assert.equal(calls.filter(x=>x.method==="POST").length,1);
 assert.equal(calls.filter(x=>x.method==="HEAD"&&x.authed).length,16);
 assert.equal(calls.filter(x=>x.method==="HEAD"&&!x.authed).length,20);
 const evidence=JSON.stringify(report);
 assert.doesNotMatch(evidence,/only-invented-admin|invented-only-password|invented-signature|aaaaaaaa-aaaa/);
});
test("an empty synthetic private source fails readiness BEFORE any anonymous comparisons",async()=>{
 for(const surface of CONTROL_SURFACES){
  const {calls,http}=fake({emptyAdmin:surface});
  const result=await runCrosscheckedHostedSurface(config,http);
  assert.equal(result.status,"CROSSCHECK_STOP_POSITIVE_FIXTURES_INCOMPLETE",surface);
  assert.equal(result.positive.passed,15);
  assert.equal(result.positive.failed,1);
  assert.equal(result.anonymous,null);
  assert.equal(calls.filter(x=>x.method==="HEAD"&&!x.authed).length,0);
 }
});
test("authorized positive controls cannot mask a private anonymous exposure",async()=>{
 for(const surface of CONTROL_SURFACES){
  const result=await runCrosscheckedHostedSurface(config,fake({leakedAnon:surface}).http);
  assert.equal(result.status,"CROSSCHECK_ANON_FAILURE_NOT_RELEASE",surface);
  assert.equal(result.positive.passed,16);
  assert.equal(result.anonymous.failed,1);
  assert.equal(result.formal_hosted_acceptance,0);
 }
});
test("missing, 403 or malformed positive HEAD metadata never proves seeded source",async()=>{
 const name=CONTROL_SURFACES[1];
 for(const alteration of [
  {badAdminStatus:name},{missingAdmin:name},{malformedAdmin:name}
 ]){
  const result=await runHostedPositiveControls(config,fake(alteration).http);
  assert.equal(result.passed,15);
  assert.equal(result.failed,1);
  assert.equal(result.case_results.find(c=>c.case_id==="positive:"+name).pass,false);
 }
});
test("wrong Auth session, unverified identity, pending profile or wrong role stop before HEAD",async()=>{
 for(const issue of [
  {badSessionId:true},{badUserId:true},{badUserStatus:true},
  {badProfile:true},{badRole:true}
 ]){
  const {calls,http}=fake(issue);
  await assert.rejects(runCrosscheckedHostedSurface(config,http));
  assert.equal(calls.filter(x=>x.method==="HEAD").length,0);
 }
});
test("production and lookalike hosts, missing admin credentials or secret keys reject before HTTP",async()=>{
 let calls=0;
 const never=async()=>{calls++;throw Error("Network must not be reached")};
 const invalid=[
  {...config,url:"https://wusntntcqgtpgokggdzv.supabase.co/"},
  {...config,url:"https://dhlhlasnaapzckjyvffn.supabase.co.bad.invalid/"},
  {...config,fixtureAck:""},
  {...config,anonKey:"sb_secret_forbidden"},
  {...config,admin:{...config.admin,expectedUserId:"bad"}},
  {...config,admin:{...config.admin,password:""}}
 ];
 for(const input of invalid)await assert.rejects(runHostedPositiveControls(input,never));
 assert.equal(calls,0);
});
