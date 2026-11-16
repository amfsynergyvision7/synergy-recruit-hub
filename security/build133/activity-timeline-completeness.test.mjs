import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCompleteCrmRows, sortCompleteCrmRows, CRM_MAX_ROWS } from "../../src/lib/bounded-crm-read.ts";
import { canReadCandidateActivityMetadata } from "../../src/lib/crm-sensitive-route-access.ts";

const src=readFileSync(new URL("../../src/routes/_app.activities.tsx",import.meta.url),"utf8");
const profile={id:"admin-a",status:"approved",is_active:true};
const rows=n=>Array.from({length:n},(_,i)=>({
 id:String(i).padStart(6,"0"),
 created_at:new Date(1730000000000+i*1000).toISOString(),
 action_type:"update",module_created:"candidates",
}));
const read=data=>async(from,to)=>({data:data.slice(from,to+1),count:data.length,error:null});

test("Build133 activity metadata requires approved, exact administrator identity",()=>{
 assert.equal(canReadCandidateActivityMetadata("admin-a",profile,"admin"),true);
 for(const role of ["viewer","finance","operations","recruiter",null])
  assert.equal(canReadCandidateActivityMetadata("admin-a",profile,role),false);
 assert.equal(canReadCandidateActivityMetadata("admin-b",profile,"admin"),false);
 assert.equal(canReadCandidateActivityMetadata("admin-a",{...profile,status:"suspended"},"admin"),false);
});

test("Build133 activity source uses narrow metadata projection and count verification",()=>{
 assert(src.includes('select("id, created_at, action_type, module_created", { count: "exact" })'));
 assert(src.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(src.includes("readCompleteCrmRows(async (from, to, signal) =>"));
 assert(!src.includes('select("*")'));
 assert(!src.includes('.limit(200)'));
});

test("Build133 activity list handles a verified empty dataset",async()=>{
 assert.deepEqual(await readCompleteCrmRows(read([]),new AbortController().signal),[]);
});

test("Build133 201 activity rows are all read rather than silently truncated",async()=>{
 const x=rows(201),got=await readCompleteCrmRows(read(x),new AbortController().signal);
 assert.equal(got.length,201);assert.equal(got.at(-1).id,"000200");
});

test("Build133 1001 source activities are correctly counted across five pages",async()=>{
 const x=rows(1001),got=await readCompleteCrmRows(read(x),new AbortController().signal);
 assert.equal(got.length,1001);assert.equal(got.at(-1).id,"001000");
});

test("Build133 2501 activities exceed the explicit safe max and fail closed",async()=>{
 const x=rows(CRM_MAX_ROWS+1);
 await assert.rejects(readCompleteCrmRows(read(x),new AbortController().signal),/exceeds verified row limit/);
});

test("Build133 activity count drift prevents partial dashboard figures",async()=>{
 const x=rows(260);let n=0;
 const query=async(from,to)=>({data:x.slice(from,to+1),count:++n===1?260:261,error:null});
 await assert.rejects(readCompleteCrmRows(query,new AbortController().signal),/changed while reading/);
});

test("Build133 activity display ordering is newest first, independent of ID paging",()=>{
 const x=rows(3);
 assert.deepEqual(sortCompleteCrmRows(x,"created_at",false).map(a=>a.id),["000002","000001","000000"]);
});

test("Build133 private activity never renders a misleading zero beneath an error",()=>{
 assert(src.includes('failed ? "Activity count unavailable"'));
 assert(src.includes("No partial timeline is displayed."));
 assert(src.includes("{!rows.length && !failed && ("));
 assert(src.includes("setRows([]); setFailed(true);"));
});

test("Build133 activity request aborts on role changes, Auth changes, unmount",()=>{
 for(const x of ["if (!allowed) return () => { active = false; controller.abort(); }",
 "return () => { active = false; controller.abort(); }",
 "}, [allowed, user?.id]);",
 "if (!active || controller.signal.aborted) return;"])
  assert(src.includes(x),x);
});

test("Build133 activity browser never fetches candidate/recruiter names or notes",()=>{
 assert(!src.includes("candidate_name"));
 assert(!src.includes("recruiter_name"));
 assert(!src.includes("candidate_id,"));
 assert(!src.includes("supabase.from(\"billing\")"));
 assert(!src.includes(".insert("));
 assert(!src.includes(".update("));
 assert(!src.includes(".delete("));
});
