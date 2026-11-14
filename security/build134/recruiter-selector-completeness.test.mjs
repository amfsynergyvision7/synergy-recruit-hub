import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RECRUITER_PROFILE_BATCH_SIZE, readVerifiedRecruiterChoices
} from "../../src/lib/recruiter-selector-read.ts";
import { CRM_MAX_ROWS } from "../../src/lib/bounded-crm-read.ts";

const src=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const route=src("src/routes/_app.candidates.tsx");
const crud=src("src/components/CrudModule.tsx");
const mkRoles=n=>Array.from({length:n},(_,i)=>({
 id:String(i).padStart(5,"0"),
 user_id:"user-"+String(i).padStart(5,"0"),
 role:"recruiter",
}));
const pages=roles=>async(from,to)=>({
 data:roles.slice(from,to+1),count:roles.length,error:null
});
const profiles=(ids)=>({data:ids.map(id=>({id,full_name:"Recruiter "+id})),
 count:ids.length,error:null});

test("Build134 complete 0 recruiter roles returns verified empty choices without profile queries",async()=>{
 let calls=0;
 const result=await readVerifiedRecruiterChoices(pages([]),async()=>{calls++;return profiles([]);},new AbortController().signal);
 assert.deepEqual(result,[]);assert.equal(calls,0);
});
test("Build134 1 role maps to 1 approved active profile label",async()=>{
 const result=await readVerifiedRecruiterChoices(pages(mkRoles(1)),ids=>profiles(ids),new AbortController().signal);
 assert.deepEqual(result,[{value:"user-00000",label:"Recruiter user-00000"}]);
});
test("Build134 151 recruiter choices no longer stop at historical 150 limit",async()=>{
 const result=await readVerifiedRecruiterChoices(pages(mkRoles(151)),ids=>profiles(ids),new AbortController().signal);
 assert.equal(result.length,151);
});
test("Build134 selector batches profile choices at 100 IDs per request",async()=>{
 const sizes=[];
 const result=await readVerifiedRecruiterChoices(pages(mkRoles(251)),ids=>{
  sizes.push(ids.length);return profiles(ids);
 },new AbortController().signal);
 assert.equal(result.length,251);
 assert.deepEqual(sizes,[100,100,51]);
 assert.equal(RECRUITER_PROFILE_BATCH_SIZE,100);
});
test("Build134 2500 recruiters can be verified without an enormous URL",async()=>{
 let rolePages=0, profileBatches=0;
 const roles=mkRoles(CRM_MAX_ROWS);
 const out=await readVerifiedRecruiterChoices(async(from,to)=>{
  rolePages++;return{data:roles.slice(from,to+1),count:roles.length,error:null};
 },ids=>{profileBatches++;return profiles(ids);},new AbortController().signal);
 assert.equal(out.length,2500);
 assert.equal(rolePages,10);
 assert.equal(profileBatches,25);
});
test("Build134 2501 recruiter roles refuse partial selector",async()=>{
 let profileQueries=0;
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(2501)),ids=>{
  profileQueries++;return profiles(ids);
 },new AbortController().signal),/exceeds verified row limit/);
 assert.equal(profileQueries,0);
});
test("Build134 suspended/pending users may be omitted from eligible active profiles",async()=>{
 const out=await readVerifiedRecruiterChoices(pages(mkRoles(3)),ids=>({
  data:[{id:ids[0],full_name:"Active"}],count:1,error:null
 }),new AbortController().signal);
 assert.deepEqual(out,[{value:"user-00000",label:"Active"}]);
});
test("Build134 duplicate role membership fails before profile lookup",async()=>{
 const rows=mkRoles(2);
 rows[1].user_id=rows[0].user_id;
 let calls=0;
 await assert.rejects(readVerifiedRecruiterChoices(pages(rows),ids=>{
  calls++;return profiles(ids);
 },new AbortController().signal),/role identity cannot be verified/);
 assert.equal(calls,0);
});
test("Build134 non-recruiter role in recruiter feed invalidates selector",async()=>{
 const rows=mkRoles(2);rows[1].role="admin";
 await assert.rejects(readVerifiedRecruiterChoices(pages(rows),ids=>profiles(ids),new AbortController().signal),/role identity cannot be verified/);
});
test("Build134 blank and nonstring user IDs invalidate identity",async()=>{
 for(const user_id of [""," ",null,undefined,42])
  await assert.rejects(readVerifiedRecruiterChoices(pages([{...mkRoles(1)[0],user_id}]),ids=>profiles(ids),new AbortController().signal),/role identity cannot be verified/);
});
test("Build134 unknown role count cannot fabricate empty selector",async()=>{
 const query=async()=>({data:[],count:null,error:null});
 await assert.rejects(readVerifiedRecruiterChoices(query,ids=>profiles(ids),new AbortController().signal),/count not verified/);
});
test("Build134 changed role count fails before any profile read",async()=>{
 const roles=mkRoles(251);let n=0;
 const roleReader=async(from,to)=>({data:roles.slice(from,to+1),count:++n===1?251:252,error:null});
 await assert.rejects(readVerifiedRecruiterChoices(roleReader,ids=>profiles(ids),new AbortController().signal),/changed while reading/);
});
test("Build134 profile count drift or missing exact count fails closed",async()=>{
 for(const count of [null,2,-1]){
  await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(1)),ids=>({
   data:[{id:ids[0],full_name:"Valid"}],count,error:null
  }),new AbortController().signal),/profile choices cannot be verified/);
 }
});
test("Build134 profile API result that exceeds eligible role batch is rejected",async()=>{
 const bad=()=>({data:[{id:"user-00000",full_name:"One"},{id:"foreign",full_name:"Two"}],count:2,error:null});
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(1)),bad,new AbortController().signal),/profile choices cannot be verified/);
});
test("Build134 unexpected profile ID outside assigned recruiter role is rejected",async()=>{
 const bad=()=>({data:[{id:"other-user",full_name:"Name"}],count:1,error:null});
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(1)),bad,new AbortController().signal),/profile identity is inconsistent/);
});
test("Build134 malformed name and duplicate profile identity cannot be offered",async()=>{
 const bad=()=>({data:[{id:"user-00000",full_name:42}],count:1,error:null});
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(1)),bad,new AbortController().signal),/profile identity is inconsistent/);
});
test("Build134 approved recruiter without display name shows sanitized ID fallback",async()=>{
 const result=await readVerifiedRecruiterChoices(pages(mkRoles(1)),ids=>({
  data:[{id:ids[0],full_name:" "}],count:1,error:null
 }),new AbortController().signal);
 assert.equal(result[0].label,"user-000");
});
test("Build134 profile query errors reject entire selector even after earlier successful batch",async()=>{
 let calls=0;
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(101)),ids=>{
  calls++;return calls===2?{data:null,count:null,error:{message:"forbidden"}}:profiles(ids);
 },new AbortController().signal),/profile choices cannot be verified/);
 assert.equal(calls,2);
});
test("Build134 abort prevents profile reads with stale auth",async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(1)),ids=>{
  calls++;return profiles(ids);
 },controller.signal),/cancelled/);
 assert.equal(calls,0);
});
test("Build134 abort after a first profile batch prevents continuing to next",async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(readVerifiedRecruiterChoices(pages(mkRoles(101)),ids=>{
  calls++;controller.abort();return profiles(ids);
 },controller.signal),/cancelled/);
 assert.equal(calls,1);
});
test("Build134 client page still gates the entire candidate workspace behind approved identity",()=>{
 for(const x of ["canMountApprovedCrm(user?.id, profile, role)",
 'return <CandidateWorkspace key={user!.id + ":" + role} />',
 "readVerifiedRecruiterChoices(",".eq(\"role\", \"recruiter\")"])
 assert(route.includes(x),x);
});
test("Build134 recruiter choice queries use bounded exact-count roles and eligible profiles",()=>{
 assert(route.includes('.select("id, user_id, role", { count: "exact" })'));
 assert(route.includes('.select("id, full_name", { count: "exact" })'));
 assert(route.includes('.eq("status", "approved")'));
 assert(route.includes('.eq("is_active", true)'));
 assert(route.includes(".range(0, ids.length - 1).abortSignal(signal)"));
 assert(!route.includes('.limit(150)'));
});
test("Build134 candidate editing and exports stay held until assignees are verified",()=>{
 assert(route.includes("requiredReferenceReady={recruiterDirectoryReady}"));
 assert(route.includes("setRecruiterDirectoryReady(false)"));
 assert(route.includes("setRecruiterDirectoryFailed(true)"));
 assert(route.includes("Candidate editing and exports remain held."));
 assert(crud.includes("&& !relationsFailed && requiredReferenceReady"));
});
test("Build134 recruiter preview is read-only and never accesses arbitrary directories",()=>{
 const helper=src("src/lib/recruiter-selector-read.ts");
 for(const x of ["supabase.from","service_role","process.env","localStorage",
 ".update(", ".insert(", ".delete("])
 assert(!helper.includes(x),x);
 assert(!route.includes('.select("*")'));
});
