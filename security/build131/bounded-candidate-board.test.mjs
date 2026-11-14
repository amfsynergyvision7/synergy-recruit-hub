import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CRM_PAGE_SIZE, CRM_MAX_ROWS, readCompleteCrmRows } from "../../src/lib/bounded-crm-read.ts";

const board=readFileSync(new URL("../../src/components/CandidateBoard.tsx",import.meta.url),"utf8");
const fixture=n=>Array.from({length:n},(_,i)=>({id:String(i).padStart(8,"0"),stage:"lead_received"}));
const reader=data=>async(from,to)=>({data:data.slice(from,to+1),count:data.length,error:null});

test("Build131 candidate board complete 251 rows crosses old cap without truncation",async()=>{
 const data=fixture(251);
 const got=await readCompleteCrmRows(reader(data),new AbortController().signal);
 assert.equal(got.length,251);
 assert.equal(got.at(-1).id,"00000250");
});

test("Build131 candidate board complete 2500 records permits all stage totals",async()=>{
 const data=fixture(CRM_MAX_ROWS);
 const got=await readCompleteCrmRows(reader(data),new AbortController().signal);
 assert.equal(got.length,2500);
 assert.equal(CRM_PAGE_SIZE,250);
});

test("Build131 board rejects 2501 total rather than silently losing a candidate",async()=>{
 const data=fixture(CRM_MAX_ROWS+1);
 await assert.rejects(readCompleteCrmRows(reader(data),new AbortController().signal),/exceeds verified row limit/);
});

test("Build131 board refuses a role-visible count drift between ID pages",async()=>{
 const rows=fixture(280);
 let i=0;
 const query=async(from,to)=>({data:rows.slice(from,to+1),count:++i===1?280:281,error:null});
 await assert.rejects(readCompleteCrmRows(query,new AbortController().signal),/changed while reading/);
});

test("Build131 board refuses an ID overlap at page boundary",async()=>{
 const rows=fixture(280);
 const query=async(from,to)=>{
  const data=rows.slice(from,to+1);
  if(from===250)data[0]={id:rows[249].id,stage:"lead_received"};
  return {data,count:rows.length,error:null};
 };
 await assert.rejects(readCompleteCrmRows(query,new AbortController().signal),/order\/identity/);
});

test("Build131 board fetch uses minimal candidate projection and exact count",()=>{
 assert(board.includes('.select("id, candidate_code, full_name, position_applied, assigned_recruiter, stage", { count: "exact" })'));
 assert(board.includes(".order(\"id\", { ascending: true }).range(from, to).abortSignal(signal)"));
 assert(board.includes("readCompleteCrmRows((from, to, signal) =>"));
 assert(!board.includes('.select("*")'));
});

test("Build131 board validates every stage rather than suppressing unknown stages",()=>{
 assert(board.includes("const stageValues = new Set(stages.map(stage => stage.value))"));
 assert(board.includes('typeof row.stage !== "string" || !stageValues.has(row.stage)'));
 assert(board.includes("setLoadFailed(true)"));
 assert(board.includes("No partial pipeline is displayed."));
});

test("Build131 stage mutations require an actual successful board snapshot",()=>{
 assert(board.includes('!loading && !loadFailed && !!lastSuccessfulRead'));
 assert(board.includes("LEGACY_CANDIDATE_WRITES_PAUSED"));
 assert(board.includes("if (LEGACY_CANDIDATE_WRITES_PAUSED)"));
 assert(board.includes("Candidate stage change could not be verified."));
});

test("Build131 board exposes correct cap without implying real-time subscriptions",()=>{
 assert(board.includes("maximum ${CRM_MAX_ROWS}"));
 assert(board.includes("${CRM_PAGE_SIZE}-row pages"));
 assert(board.includes("no realtime updates."));
 assert(!board.includes("supabase.channel("));
 assert(!board.includes('.on("postgres_changes"'));
});

test("Build131 stale and unmounted board requests are discarded",()=>{
 assert(board.includes("requestController.current?.abort()"));
 assert(board.includes("epoch !== loadEpoch.current"));
 assert(board.includes("return () => { loadEpoch.current++; requestController.current?.abort(); }"));
});

test("Build131 board never opens privileged SQL or sends mail",()=>{
 for(const frag of ["service_role",'.insert(','.update({ stage: newStage })','sendEmail','process.env'])
   assert(!board.includes(frag),frag);
});

test("Build131 candidate board requires separately verified app shell and role",()=>{
 const route=readFileSync(new URL("../../src/routes/_app.candidates.tsx",import.meta.url),"utf8");
 assert(route.includes('canMountApprovedCrm(user?.id, profile, role)'));
 assert(route.includes('<CandidateWorkspace key={user!.id + ":" + role} />'));
});
