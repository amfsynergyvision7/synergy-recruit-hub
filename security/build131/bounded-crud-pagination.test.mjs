import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 CRM_PAGE_SIZE, CRM_MAX_ROWS, readCompleteCrmRows, sortCompleteCrmRows
} from "../../src/lib/bounded-crm-read.ts";

const sample=n=>Array.from({length:n},(_,i)=>({
 id:String(i).padStart(6,"0"),
 created_at:`2026-11-${String((i%28)+1).padStart(2,"0")}`,
 name:"Example",score:i
}));
const mock=(rows,opts={})=>{
 let calls=0;
 const reader=async(from,to,signal)=>{
  calls++;
  return opts.read ? opts.read({from,to,signal,rows,calls}) :
    {data:rows.slice(from,to+1),count:rows.length,error:null};
 };
 return {reader,get calls(){return calls}};
};

test("Build131 bounded CRUD uses 250-record pages and a hard 2500-record cap",()=>{
 assert.equal(CRM_PAGE_SIZE,250);
 assert.equal(CRM_MAX_ROWS,2500);
});

test("Build131 empty approved list needs one count-verifying request",async()=>{
 const x=mock([]);
 assert.deepEqual(await readCompleteCrmRows(x.reader,new AbortController().signal),[]);
 assert.equal(x.calls,1);
});

test("Build131 exact 250 record list takes one read",async()=>{
 const x=mock(sample(250));
 assert.equal((await readCompleteCrmRows(x.reader,new AbortController().signal)).length,250);
 assert.equal(x.calls,1);
});

test("Build131 251 records are not falsely dismissed as overflowing",async()=>{
 const x=mock(sample(251));
 assert.equal((await readCompleteCrmRows(x.reader,new AbortController().signal)).length,251);
 assert.equal(x.calls,2);
});

test("Build131 1001 records are fully accounted for beyond default PostgREST cap",async()=>{
 const x=mock(sample(1001));
 const rows=await readCompleteCrmRows(x.reader,new AbortController().signal);
 assert.equal(rows.length,1001);
 assert.equal(rows.at(-1).id,"001000");
 assert.equal(x.calls,5);
});

test("Build131 exact maximum 2500 accepted in ten pages",async()=>{
 const x=mock(sample(2500));
 const result=await readCompleteCrmRows(x.reader,new AbortController().signal);
 assert.equal(result.length,2500);
 assert.equal(x.calls,10);
});

test("Build131 2501 records fail before returning any partial data",async()=>{
 const x=mock(sample(2501));
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/exceeds verified row limit/);
 assert.equal(x.calls,1);
});

test("Build131 truncated second page cannot become an apparently complete export",async()=>{
 const rows=sample(260);
 const x=mock(rows,{read:({from,to,rows})=>({
  data:rows.slice(from,from===0?to+1:from+2),count:rows.length,error:null
 })});
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/incomplete/);
});

test("Build131 count drift rejects a concurrent data insert or deletion",async()=>{
 const rows=sample(300);
 const x=mock(rows,{read:({from,to,calls,rows})=>({
  data:rows.slice(from,to+1),count:calls===1?300:301,error:null
 })});
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/changed while reading/);
});

test("Build131 out-of-order or repeated IDs never complete a CRM snapshot",async()=>{
 const rows=sample(260);
 const x=mock(rows,{read:({from,to,rows})=>{
  const data=rows.slice(from,to+1);
  if(from===250)data[0]={...data[0],id:rows[249].id};
  return {data,count:rows.length,error:null};
 }});
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/order\/identity/);
});

test("Build131 refuses missing exact row count",async()=>{
 const x=mock([],{read:()=>({data:[],count:null,error:null})});
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/unavailable or count/);
});

test("Build131 prior cancellation issues no new database request",async()=>{
 const controller=new AbortController();controller.abort();
 const x=mock(sample(20));
 await assert.rejects(readCompleteCrmRows(x.reader,controller.signal),/cancelled/);
 assert.equal(x.calls,0);
});

test("Build131 cancellation during a page cannot reveal a partial list",async()=>{
 const controller=new AbortController();
 const x=mock(sample(20),{read:()=>{controller.abort();return{data:sample(20),count:20,error:null}}});
 await assert.rejects(readCompleteCrmRows(x.reader,controller.signal),/cancelled/);
});

test("Build131 display sort is deterministic, with immutable input and ID tie-break",()=>{
 const original=[{id:"b",created_at:"2026-10-05"},{id:"a",created_at:"2026-10-05"},
                 {id:"c",created_at:"2026-10-06"}];
 const sorted=sortCompleteCrmRows(original,"created_at",false);
 assert.deepEqual(sorted.map(x=>x.id),["c","a","b"]);
 assert.deepEqual(original.map(x=>x.id),["b","a","c"]);
});

test("Build131 numeric ascending/descending sort respects number values",()=>{
 const rows=[{id:"a",rank:10},{id:"b",rank:2},{id:"c",rank:3}];
 assert.deepEqual(sortCompleteCrmRows(rows,"rank",true).map(x=>x.id),["b","c","a"]);
 assert.deepEqual(sortCompleteCrmRows(rows,"rank",false).map(x=>x.id),["a","c","b"]);
});

test("Build131 display sort places null values last",()=>{
 const rows=[{id:"a",score:null},{id:"b",score:2},{id:"c",score:1}];
 assert.deepEqual(sortCompleteCrmRows(rows,"score",true).map(x=>x.id),["c","b","a"]);
 assert.deepEqual(sortCompleteCrmRows(rows,"score",false).map(x=>x.id),["b","c","a"]);
});

test("Build131 rejects unsafe dynamic display sort keys",()=>{
 assert.throws(()=>sortCompleteCrmRows(sample(1),"id); DROP TABLE",false),/Invalid CRM display sort field/);
 assert.throws(()=>sortCompleteCrmRows(sample(1),"",false),/Invalid CRM display sort field/);
});

test("Build131 rejects non-finite number sort fields",()=>{
 assert.throws(()=>sortCompleteCrmRows([{id:"a",rank:Infinity},{id:"b",rank:2}],"rank"),/Invalid CRM numeric sort field/);
});

test("Build131 snapshot contract remains browser-only with no privileged key",()=>{
 const src=readFileSync(new URL("../../src/lib/bounded-crm-read.ts",import.meta.url),"utf8");
 for(const forbidden of ["service_role","supabase.from","process.env","insert(","upsert(","delete(","update("])
  assert(!src.includes(forbidden),forbidden);
});

test("Build131 source uses checked ID paging and account-scoped verified tables",()=>{
 const ui=readFileSync(new URL("../../src/components/CrudModule.tsx",import.meta.url),"utf8");
 assert(ui.includes("canMountApprovedCrm(user?.id, profile, role)"));
 assert(ui.includes("readCompleteCrmRows(async (from, to, signal) =>"));
 assert(ui.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(ui.includes("sortCompleteCrmRows(data, orderBy?.column"));
 assert(ui.includes("setRowsVerified(true)"));
 assert(ui.includes("verifiedForMutation = rowsVerified && relationsLoaded && !loading"));
});

test("Build131 incomplete selector list blocks editing and CSV rather than showing blank foreign labels",()=>{
 const ui=readFileSync(new URL("../../src/components/CrudModule.tsx",import.meta.url),"utf8");
 assert(ui.includes('select(crmRelationProjection(field.relation!.select), { count: "exact" })'));
 assert(ui.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(ui.includes("setRelationsLoaded(false)"));
 assert(ui.includes("setRelationsFailed(true)"));
 assert(ui.includes("&& verifiedForMutation"));
 assert(ui.includes("if (!verifiedForMutation)"));
 assert(ui.includes("Editing and exports are withheld."));
 assert(ui.includes("disabled={filtered.length === 0 || !verifiedForMutation}"));
});

test("Build131 previous candidate/finance/joined status mutation holds still apply",()=>{
 const ui=readFileSync(new URL("../../src/components/CrudModule.tsx",import.meta.url),"utf8");
 for(const hold of ["LEGACY_CANDIDATE_WRITES_PAUSED","LEGACY_BILLING_MUTATIONS_PAUSED",
                    "LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED","bulkMutationPending.current"])
   assert(ui.includes(hold),hold);
});

test("Build131 relation selector reads complete 251-row snapshots, not partial 250 rows",async()=>{
 const x=mock(sample(251));
 const rows=await readCompleteCrmRows(x.reader,new AbortController().signal);
 assert.equal(rows.length,251);
 assert.equal(x.calls,2);
});

test("Build131 relation selector refuses over-cap 2501 rows",async()=>{
 const x=mock(sample(2501));
 await assert.rejects(readCompleteCrmRows(x.reader,new AbortController().signal),/exceeds verified row limit/);
 assert.equal(x.calls,1);
});

test("Build131 related selector source uses the same ID count-reconciled reader as main records",()=>{
 const ui=readFileSync(new URL("../../src/components/CrudModule.tsx",import.meta.url),"utf8");
 assert.equal((ui.match(/readCompleteCrmRows\(async \(from, to, signal\) =>/g)||[]).length,2);
 assert(ui.includes("if (!controller.signal.aborted && epoch === relationEpoch.current) {"));
 assert(ui.includes("setRelationsLoaded(true)"));
 assert(ui.includes("setRelationsLoaded(false)"));
});
