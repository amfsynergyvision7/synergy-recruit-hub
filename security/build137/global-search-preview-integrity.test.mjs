import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeSearchPreview, decodeSearchBuckets, MAX_SEARCH_PREVIEW_ROWS } from "../../src/lib/global-search-results.ts";

const src=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const ui=src("src/components/GlobalSearch.tsx");
const shell=src("src/routes/_app.tsx");
const c=(id="candidate-1")=>({id,full_name:"Example Candidate",candidate_code:null,position_applied:null});
const cl=(id="client-1")=>({id,company_name:"Example Client",contact_person:null});
const j=(id="job-1")=>({id,job_title:"Example Role",location:null});

test("Build137 empty verified preview is legitimate for all three modules",()=>{
 assert.deepEqual(decodeSearchBuckets({candidates:[],clients:[],jobs:[]}),{
 candidates:[],clients:[],jobs:[]
 });
});
test("Build137 mixed valid suggestion records are normalized in source order",()=>{
 assert.deepEqual(decodeSearchBuckets({
 candidates:[{...c(),candidate_code:"AMF-01",position_applied:"Analyst"}],
 clients:[{...cl(),contact_person:"Alice"}],
 jobs:[{...j(),location:"Kolkata"}],
 }),{
 candidates:[{id:"candidate-1",label:"Example Candidate",sublabel:"AMF-01 · Analyst"}],
 clients:[{id:"client-1",label:"Example Client",sublabel:"Alice"}],
 jobs:[{id:"job-1",label:"Example Role",sublabel:"Kolkata"}],
 });
});
test("Build137 each module allows exactly six previews; the seventh is not a full list",()=>{
 assert.equal(MAX_SEARCH_PREVIEW_ROWS,6);
 for(const [scope,make] of [["candidates",c],["clients",cl],["jobs",j]]){
  assert.equal(decodeSearchPreview(scope,Array.from({length:6},(_,i)=>make("id-"+i))).length,6);
  assert.throws(()=>decodeSearchPreview(scope,Array.from({length:7},(_,i)=>make("id-"+i))),/Unverified/);
 }
});
test("Build137 missing, unknown and malformed buckets invalidate all results",()=>{
 for(const bad of [null,undefined,{},12,"[]"])
  assert.throws(()=>decodeSearchPreview("clients",bad),/Unverified/);
 assert.throws(()=>decodeSearchBuckets({candidates:[c()],clients:null,jobs:[j()]}),/Unverified/);
 assert.throws(()=>decodeSearchPreview("unreviewed",[]),/Unverified/);
});
test("Build137 blank and duplicate IDs cannot produce a credible preview",()=>{
 for(const id of ["","  ",null,undefined,42])
  assert.throws(()=>decodeSearchPreview("candidates",[{...c(),id}]),/Unverified/);
 assert.throws(()=>decodeSearchPreview("clients",[cl(),cl()]),/Unverified/);
});
test("Build137 source labels must be non-empty strings",()=>{
 for(const full_name of ["","  ",null,undefined,42])
  assert.throws(()=>decodeSearchPreview("candidates",[{...c(),full_name}]),/Unverified/);
 for(const company_name of ["",false,undefined])
  assert.throws(()=>decodeSearchPreview("clients",[{...cl(),company_name}]),/Unverified/);
 for(const job_title of ["",{},null])
  assert.throws(()=>decodeSearchPreview("jobs",[{...j(),job_title}]),/Unverified/);
});
test("Build137 secondary fields must be nullable strings, never arbitrary user objects",()=>{
 for(const field of ["candidate_code","position_applied"]){
  for(const value of [42,undefined,false,{}])
   assert.throws(()=>decodeSearchPreview("candidates",[{...c(),[field]:value}]),/Unverified/);
 }
 for(const value of [12,undefined,{}])
  assert.throws(()=>decodeSearchPreview("clients",[{...cl(),contact_person:value}]),/Unverified/);
 for(const value of [false,undefined,42])
  assert.throws(()=>decodeSearchPreview("jobs",[{...j(),location:value}]),/Unverified/);
});
test("Build137 malformed row in a later module prevents publishing earlier private results",()=>{
 assert.throws(()=>decodeSearchBuckets({
  candidates:[c()], clients:[cl()], jobs:[{...j(),id:null}],
 }),/Unverified/);
});
test("Build137 no raw backend errors or uncontrolled source projections are shown",()=>{
 assert(ui.includes("decodeSearchBuckets({"));
 assert(ui.includes("if (candidatesRes.error || clientsRes.error || jobsRes.error)"));
 assert(ui.includes("Search is temporarily unavailable."));
 assert(!ui.includes("candidatesRes.error.message"));
 assert(!ui.includes("toast.error(error.message)"));
 for(const t of ['.select("id, full_name, candidate_code, position_applied")',
                  '.select("id, company_name, contact_person")',
                  '.select("id, job_title, location")'])assert(ui.includes(t),t);
 assert(!ui.includes('.select("*")'));
});
test("Build137 quick search uses bounded stable six-per-module suggestions, not complete claims",()=>{
 assert.equal((ui.match(/\.limit\(MAX_SEARCH_PREVIEW_ROWS\)/g)||[]).length,3);
 assert.equal((ui.match(/\.order\("id", \{ ascending: true \}\)/g)||[]).length,3);
 assert(ui.includes("Showing up to {MAX_SEARCH_PREVIEW_ROWS} matches per category; open a module for complete results."));
 assert(ui.includes("Open a CRM module for a complete list."));
});
test("Build137 approved user shell mounts private search only after the exact role gate",()=>{
 assert(shell.includes("canMountApprovedCrm(session.user.id, profile, role)"));
 assert(shell.includes('return <ApprovedAppShell key={session.user.id} userId={session.user.id}'));
 assert(shell.includes("<GlobalSearch />"));
 assert(shell.indexOf("canMountApprovedCrm(session.user.id, profile, role)")<shell.indexOf("return <ApprovedAppShell"));
});
test("Build137 account and search edits clear old private suggestions and cancel requests",()=>{
 assert(ui.includes("snapshot?.term === term"));
 assert(ui.includes("snapshot.results : EMPTY_RESULTS"));
 assert(ui.includes("setSnapshot(null);"));
 assert(ui.includes("controller.abort();"));
 assert(ui.includes("clearTimeout(timer);"));
 assert.equal((ui.match(/\.abortSignal\(controller\.signal\)/g)||[]).length,3);
 assert(ui.includes("if (!active || controller.signal.aborted) return;"));
});
