import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {runConfirmedBulkMutation} from "../../src/lib/confirmed-bulk-mutation.ts";
const ids = (n) => Array.from({length:n},(_,i)=>"row_"+(i+1));
test("exact 205 IDs in 100/100/5 batches confirm, never overcount",async()=>{
 const calls=[];
 const result=await runConfirmedBulkMutation(ids(205),async(batch)=>{
  calls.push(batch.length);
  return {data:batch.map(id=>({id})),error:null};
 });
 assert.deepEqual(calls,[100,100,5]);
 assert.equal(result.complete,true);
 assert.equal(result.confirmedCount,205);
});
test("RLS silent zero-row UPDATE cannot report success",async()=>{
 const r=await runConfirmedBulkMutation(ids(2),async()=>({data:[],error:null}));
 assert.equal(r.complete,false);
 assert.equal(r.confirmedCount,0);
});
test("unknown network outcome after completed first batch is not replayed",async()=>{
 let calls=0;
 const r=await runConfirmedBulkMutation(ids(205),async(batch)=>{
  calls++;
  if(calls===2) throw new Error("synthetic network timeout with PII");
  return {data:batch.map(id=>({id}))};
 });
 assert.equal(calls,2);
 assert.equal(r.complete,false);
 assert.equal(r.confirmedCount,100);
 assert.doesNotMatch(r.message,/PII/);
});
test("partial responses, duplicate response IDs, extras fail closed",async()=>{
 for(const returned of [
  [{id:"row_1"}],
  [{id:"row_1"},{id:"row_1"}],
  [{id:"row_1"},{id:"other"}],
 ]){
  const r=await runConfirmedBulkMutation(ids(2),async()=>({data:returned}));
  assert.equal(r.complete,false);
 }
});
test("invalid selection fails without dispatch",async()=>{
 let calls=0;
 for(const list of [[],["one","one"],["", "two"]]){
  const r=await runConfirmedBulkMutation(list,async()=>{calls++;return {data:[]}});
  assert.equal(r.complete,false);
 }
 assert.equal(calls,0);
});
test("current UI retains candidate, finance and joined holds and clears selection on uncertain bulk",()=>{
 const c=readFileSync("src/components/CrudModule.tsx","utf8");
 assert.match(c,/runConfirmedBulkMutation/);
 assert.match(c,/if \(candidateMutationPaused\)/);
 assert.match(c,/if \(billingMutationPaused\)/);
 assert.match(c,/LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED/);
 assert.match(c,/bulkMutationPending\.current/);
 assert.match(c,/setSelected\(new Set\(\)\)/);
 assert.doesNotMatch(c,/toast\.success\(`Deleted \$\{ids\.length\}/);
});

test("both selection controls locked during bulk mutation",()=>{
 const c=readFileSync("src/components/CrudModule.tsx","utf8");
 assert.match(c,/const toggleAll = \(checked: boolean\) => \{\n    if \(bulkMutationPending\.current\) return;/);
 assert.match(c,/const toggleRow = \(id: string, checked: boolean\) => \{\n    if \(bulkMutationPending\.current\) return;/);
});
test("PR11 active-only recruiter selection safely ported; no candidate DML bypass",()=>{
 const route=readFileSync("src/routes/_app.candidates.tsx","utf8");
 const board=readFileSync("src/components/CandidateBoard.tsx","utf8");
 assert.match(route,/\.eq\('status', 'approved'\)\s*\.eq\('is_active', true\)/);
 assert.match(board,/LEGACY_CANDIDATE_WRITES_PAUSED/);
 assert.match(board,/changeCandidateStage/);
 assert.doesNotMatch(board,/\.update\(\{ stage: newStage \}\)/);
});
