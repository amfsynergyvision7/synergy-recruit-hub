import test from "node:test";
import assert from "node:assert/strict";
import {runAnonymousSurfacePreflight,PRIVATE_EXTRA_TABLES,PUBLIC_VIEWS,
 PRIVATE_BRANDING_COLUMNS,PUBLIC_BRANDING_COLUMNS} from "./hosted-anon-extra-scope.mjs";

const config={url:"https://dhlhlasnaapzckjyvffn.supabase.co/",
 anonKey:"sb_publishable_mock_not_a_real_key",
 fixtureAck:"I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES"};
const fake=(override={})=>{
 const calls=[];
 async function http(url,opts){
  const u=new URL(url);
  calls.push({url,method:opts.method,redirect:opts.redirect});
  assert.equal(u.origin,"https://dhlhlasnaapzckjyvffn.supabase.co");
  assert.equal(opts.method,"HEAD");
  assert.equal(opts.headers.Prefer,"count=exact");
  assert.equal(opts.redirect,"error");
  assert.ok(!opts.headers.Authorization,"no token or service role bearer");
  assert.equal(opts.headers.apikey,config.anonKey);
  const name=u.pathname.split("/").at(-1);
  assert.ok([...PRIVATE_EXTRA_TABLES,...PUBLIC_VIEWS,"app_settings"].includes(name));
  const cols=u.searchParams.get("select");
  let count=0,status=200,range=null;
  if(name==="app_settings"&&cols===PUBLIC_BRANDING_COLUMNS.join(",")){
   count=1;
  }else if(name==="app_settings"&&PRIVATE_BRANDING_COLUMNS.includes(cols)){
   status=403;
  }
  if(override.name===name && (!override.select||override.select===cols)){
   if(override.kind==="expose"){status=200;count=1}
   if(override.kind==="empty-private"){status=200;count=0}
   if(override.kind==="missing"){status=404}
   if(override.kind==="server-error"){status=500}
   if(override.kind==="malformed"){status=200;range="unparseable"}
  }
  if(!range&&status===200)range=count===0?"*/0":"0-"+(Math.min(count,2)-1)+"/"+count;
  return {status,ok:status===200,
    headers:{get:key=>key==="content-range"?range:null},
    json:async()=>{throw Error("HEAD response body must never be accessed")}};
 }
 return {http,calls};
};
test("all 20 unnamed anonymous surface probes complete without real records or writes",async()=>{
 const {http,calls}=fake();
 const result=await runAnonymousSurfacePreflight(config,http);
 assert.equal(result.checks,20);
 assert.equal(result.passed,20);
 assert.equal(result.failed,0);
 assert.equal(result.formal_hosted_acceptance,0);
 assert.equal(calls.length,20);
 assert.ok(calls.every(c=>c.method==="HEAD"&&c.redirect==="error"));
 assert.equal(result.case_results.filter(x=>x.case_id.startsWith("table:")).length,3);
 assert.equal(result.case_results.filter(x=>x.case_id.startsWith("view:")).length,13);
 assert.equal(result.case_results.filter(x=>x.case_id.startsWith("branding-private:")).length,3);
 assert.equal(result.case_results.filter(x=>x.case_id==="branding-public:projection").length,1);
 const serialized=JSON.stringify(result);
 assert.doesNotMatch(serialized,/synthetic-only|sb_publishable_mock|logo_url":"synthetic/);
});
test("a leak in each of three private tables and thirteen views cannot pass",async()=>{
 for(const name of [...PRIVATE_EXTRA_TABLES,...PUBLIC_VIEWS]){
  const result=await runAnonymousSurfacePreflight(config,fake({name,kind:"expose"}).http);
  assert.equal(result.failed,1,name);
  assert.equal(result.passed,19);
  assert.equal(result.formal_hosted_acceptance,0);
 }
});
test("private branding columns require explicit 401/403, not even empty 200",async()=>{
 for(const select of PRIVATE_BRANDING_COLUMNS){
  const result=await runAnonymousSurfacePreflight(config,
   fake({name:"app_settings",select,kind:"empty-private"}).http);
  assert.equal(result.failed,1,select);
 }
});
test("404 missing schema, 500 server error or malformed 200 never prove anonymous denial",async()=>{
 for(const kind of ["missing","server-error","malformed"]){
  const result=await runAnonymousSurfacePreflight(config,
   fake({name:"workflow_rules",kind}).http);
  assert.equal(result.failed,1,kind);
 }
});
test("missing or wrong branding fixture does not count as accepted",async()=>{
 for(const kind of ["missing","server-error","malformed","empty-private"]){
  const result=await runAnonymousSurfacePreflight(config,
   fake({name:"app_settings",select:"logo_url,default_color_theme",kind}).http);
  assert.equal(result.failed,1,kind);
 }
});
test("production host, unseeded fixture and privileged key are rejected before HTTP",async()=>{
 let calls=0;const fail=async()=>{calls++;throw Error("unexpected outbound HTTP")};
 for(const invalid of [
  {...config,url:"https://wusntntcqgtpgokggdzv.supabase.co/"},
  {...config,url:"https://dhlhlasnaapzckjyvffn.supabase.co.evil.example/"},
  {...config,fixtureAck:""},
  {...config,anonKey:"sb_secret_unsafe"},
  {...config,anonKey:"sb_service_role_unsafe"}
 ]){
  await assert.rejects(runAnonymousSurfacePreflight(invalid,fail));
 }
 assert.equal(calls,0);
});

test("anonymous inspection refuses success without a trustworthy exact Content-Range",async()=>{
 for(const name of [...PRIVATE_EXTRA_TABLES,...PUBLIC_VIEWS]){
  const base=fake({name,kind:"malformed"});
  const result=await runAnonymousSurfacePreflight(config,base.http);
  assert.equal(result.failed,1,name);
 }
});
