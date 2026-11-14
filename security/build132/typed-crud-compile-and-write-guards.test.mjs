import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkedCrmPageIds, readCompleteCrmRows } from "../../src/lib/bounded-crm-read.ts";

const source=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const crud=source("src/components/CrudModule.tsx");
const fast=source(".github/workflows/security-build65-fast.yml");

test("Build132 page decoder accepts a verified empty page and null transport value",()=>{
 assert.deepEqual(checkedCrmPageIds([]),[]);
 assert.equal(checkedCrmPageIds(null),null);
});
test("Build132 page decoder rejects non-array payloads and undefined",()=>{
 for(const data of [undefined,{},1,NaN,"[]",true]) assert.throws(()=>checkedCrmPageIds(data),/unsupported or malformed/);
});
test("Build132 page decoder rejects numeric settings IDs rather than coercing identities",()=>{
 assert.throws(()=>checkedCrmPageIds([{id:1}]),/unsupported or malformed/);
 assert.throws(()=>checkedCrmPageIds([{id:0}]),/unsupported or malformed/);
});
test("Build132 page decoder rejects whitespace-only and empty row identifiers",()=>{
 for(const id of [""," ","\n","\t"]) assert.throws(()=>checkedCrmPageIds([{id}]),/unsupported or malformed/);
});
test("Build132 page decoder rejects missing, null and nonstring identifiers",()=>{
 for(const id of [null,undefined,123,false,{},[]]) assert.throws(()=>checkedCrmPageIds([{id}]),/unsupported or malformed/);
});
test("Build132 page decoder rejects null, primitives and nested arrays as rows",()=>{
 for(const row of [null,"id",[],42,true]) assert.throws(()=>checkedCrmPageIds([row]),/unsupported or malformed/);
});
test("Build132 page decoder allows valid UUID rows and retains additional permitted fields",()=>{
 const rows=[{id:"00000000-0000-0000-0000-000000000001",stage:"lead_received"}];
 assert.strictEqual(checkedCrmPageIds(rows),rows);
 assert.equal(checkedCrmPageIds(rows)?.[0].stage,"lead_received");
});
test("Build132 page decoder does not sanitize malformed data into a false complete result",()=>{
 assert.throws(()=>checkedCrmPageIds([{id:"okay"},{id:3}]),/unsupported or malformed/);
});
test("Build132 duplicate and conflicting IDs are still checked by bounded transport",async()=>{
 const c=new AbortController();
 const reader=async()=>({data:checkedCrmPageIds([{id:"x"},{id:"x"}]),count:2,error:null});
 await assert.rejects(readCompleteCrmRows(reader,c.signal),/order\/identity/);
});
test("Build132 missing count remains fail-closed after ID narrowing",async()=>{
 const c=new AbortController();
 const reader=async()=>({data:checkedCrmPageIds([{id:"x"}]),count:null,error:null});
 await assert.rejects(readCompleteCrmRows(reader,c.signal),/count not verified/);
});
test("Build132 dynamic Supabase table reads await the response before runtime type narrowing",()=>{
 assert.equal((crud.match(/const result = await supabase\.from\(/g)||[]).length,2);
 assert.equal((crud.match(/data: checkedCrmPageIds\(result\.data\)/g)||[]).length,2);
 assert(!crud.includes("result.data as unknown as { id: string }[]"));
 assert(crud.includes("readCompleteCrmRows(async (from, to, signal) =>"));
});
test("Build132 holds all four mutation callbacks after unconditional candidate/billing checks",()=>{
 for(const [name,gate] of [["save","editable"],["remove","deletable"],
                           ["bulkDelete","deletable"],["applyBulkEdit","editable"]]){
  const index=crud.indexOf("const "+name+" = async ");
  assert(index>=0,name);
  const excerpt=crud.slice(index,index+570);
  assert(excerpt.includes('if (candidateMutationPaused)'));
  assert(excerpt.includes('if (billingMutationPaused)'));
  assert(excerpt.includes("if (!"+gate+")"),name);
 }
});
test("Build132 preserves candidate status and finance transition holds",()=>{
 for(const guard of ["LEGACY_CANDIDATE_WRITES_PAUSED","LEGACY_BILLING_MUTATIONS_PAUSED",
  "LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED","CANDIDATE_MUTATION_HOLD_REASON",
  "BILLING_MUTATION_HOLD_REASON","FINANCIAL_JOINED_HOLD_REASON"])
  assert(crud.includes(guard),guard);
});
test("Build132 fast workflow fails on compiled TypeScript, not only mocked source tests",()=>{
 assert(fast.includes("application-typecheck-fast:"));
 assert(fast.includes("npm ci --ignore-scripts --no-audit --no-fund"));
 assert(fast.includes("npm run build"));
 assert(fast.includes("npx tsc --noEmit"));
 const section=fast.slice(fast.indexOf("application-typecheck-fast:"),
                           fast.indexOf("hosted-uat-offline-contracts:"));
 assert(section.indexOf("npm run build")<section.indexOf("npx tsc --noEmit"));
});
test("Build132 fast build gate uses no remote database or application service key",()=>{
 const section=fast.slice(fast.indexOf("application-typecheck-fast:"),
                           fast.indexOf("hosted-uat-offline-contracts:"));
 assert(!section.includes("SUPABASE_SERVICE_ROLE_KEY"));
 assert(!section.includes("secrets."));
 assert(!section.includes("workflow_dispatch"));
});
test("Build132 production-release hold remains in guarded CI",()=>{
 const workflow=source(".github/workflows/security-build34-review.yml");
 assert(workflow.includes("production-release-hold:"));
 assert(workflow.includes("exit 1"));
});

test("Build132 fast CI executes both independent historical candidate and finance holds",()=>{
 const section=fast.slice(fast.indexOf("critical-write-hold-contracts:"),
   fast.indexOf("hosted-uat-offline-contracts:"));
 assert(section.includes("node --test security/build50/source-contract.test.mjs security/build56/source-contract.test.mjs"));
 assert(!section.includes("secrets."));
});
