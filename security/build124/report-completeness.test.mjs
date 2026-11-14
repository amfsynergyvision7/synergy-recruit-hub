import test from "node:test";
import assert from "node:assert/strict";
import {
 REPORT_PAGE_SIZE, REPORT_MAX_ROWS, readBoundedReportRows
} from "../../src/lib/bounded-report-read.ts";

const rowsOf=n=>Array.from({length:n},(_,i)=>({id:String(i).padStart(6,"0"),stage:"joined"}));
const controller=()=>new AbortController();
const fake=(rows,opts={})=>{
 let calls=0;
 const request=async(from,to,signal)=>{
  calls++;
  if(opts.read) return opts.read({from,to,signal,calls,rows});
  return {data:rows.slice(from,to+1),count:rows.length,error:null};
 };
 return {request,get calls(){return calls}};
};
test("Build124 0 records returns empty from one audited count and one query",async()=>{
 const x=fake([]);
 assert.deepEqual(await readBoundedReportRows(x.request,controller().signal),[]);
 assert.equal(x.calls,1);
});
test("Build124 exactly one page does not double-read",async()=>{
 const a=rowsOf(REPORT_PAGE_SIZE),x=fake(a);
 assert.equal((await readBoundedReportRows(x.request,controller().signal)).length,a.length);
 assert.equal(x.calls,1);
});
test("Build124 paginates 1001 records across default backend 1000 limit",async()=>{
 const a=rowsOf(1001),ranges=[],x=fake(a,{read:({from,to,rows})=>{
  ranges.push([from,to]);return {data:rows.slice(from,to+1),count:rows.length,error:null};
 }});
 const got=await readBoundedReportRows(x.request,controller().signal);
 assert.equal(got.length,1001);assert.equal(got.at(-1).id,"001000");
 assert.deepEqual(ranges,[[0,249],[250,499],[500,749],[750,999],[1000,1249]]);
});
test("Build124 exact max 2500 is accepted, but 2501 fails before exporting any data",async()=>{
 const exactly=fake(rowsOf(REPORT_MAX_ROWS));
 assert.equal((await readBoundedReportRows(exactly.request,controller().signal)).length,REPORT_MAX_ROWS);
 assert.equal(exactly.calls,10);
 const tooMany=fake(rowsOf(REPORT_MAX_ROWS+1));
 await assert.rejects(readBoundedReportRows(tooMany.request,controller().signal),/exceeds verified row limit/);
 assert.equal(tooMany.calls,1);
});
test("Build124 rejects server-side page truncation rather than misreporting partial KPIs",async()=>{
 const f=fake(rowsOf(300),{read:({from,to,rows})=>({
  data:rows.slice(from,Math.min(to+1,from+100)),count:rows.length,error:null
 })});
 await assert.rejects(readBoundedReportRows(f.request,controller().signal),/incomplete/);
});
test("Build124 rejects changing row counts during multi-page reads",async()=>{
 const a=rowsOf(501),f=fake(a,{read:({from,to,calls,rows})=>({
  data:rows.slice(from,to+1),count:calls===1?501:502,error:null
 })});
 await assert.rejects(readBoundedReportRows(f.request,controller().signal),/changed while reading/);
});
test("Build124 rejects duplicated IDs across distinct pages even if counts appear correct",async()=>{
 const a=rowsOf(300),f=fake(a,{read:({from,to,rows})=>{
  const data=rows.slice(from,to+1);
  if(from===250)data[0]={...data[0],id:rows[249].id};
  return {data,count:rows.length,error:null};
 }});
 await assert.rejects(readBoundedReportRows(f.request,controller().signal),/order\/identity/);
});
test("Build124 rejects silently shuffled rows and missing IDs",async()=>{
 const a=rowsOf(2),swapped=fake([a[1],a[0]]);
 await assert.rejects(readBoundedReportRows(swapped.request,controller().signal),/order\/identity/);
 const missing=fake([{id:""}]);
 await assert.rejects(readBoundedReportRows(missing.request,controller().signal),/order\/identity/);
});
test("Build124 fails closed on API errors, null count, invalid count or missing data",async()=>{
 for(const bad of [
 {data:[],count:null,error:null},
 {data:[],count:-1,error:null},
 {data:null,count:0,error:null},
 {data:[],count:0,error:{message:"sensitive DB error"}}
 ]) {
  const f=fake([],{read:()=>bad});
  await assert.rejects(readBoundedReportRows(f.request,controller().signal),/unavailable or count not verified/);
 }
});
test("Build124 never issues network requests after the query was cancelled",async()=>{
 const ac=controller();ac.abort();
 const f=fake(rowsOf(2));
 await assert.rejects(readBoundedReportRows(f.request,ac.signal),/cancelled/);
 assert.equal(f.calls,0);
});
test("Build124 late aborted response is rejected before materializing rows",async()=>{
 const ac=controller(),f=fake(rowsOf(4),{read:()=>{ac.abort();return {data:rowsOf(4),count:4,error:null}}});
 await assert.rejects(readBoundedReportRows(f.request,ac.signal),/cancelled/);
 assert.equal(f.calls,1);
});
test("Build124 invalid response must not leak raw PostgREST server messages",async()=>{
 const f=fake([],{read:()=>({data:null,count:null,error:{message:"real candidate email leaked"}})});
 await assert.rejects(readBoundedReportRows(f.request,controller().signal),err=>{
  assert(!err.message.includes("candidate email"));return true;
 });
});
