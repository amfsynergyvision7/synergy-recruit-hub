import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasCompleteIdList } from "../../src/lib/crm-list-integrity.ts";
import { canMountApprovedCrm } from "../../src/lib/crm-shell-access.ts";

const source = path => readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const ui=source("src/components/CrudModule.tsx");
const approved={id:"account-a",status:"approved",is_active:true};

test("Build128 list accepts a complete 0/0 exact response",()=>{
 assert.equal(hasCompleteIdList([],0,250),true);
});

test("Build128 list accepts exact 1/1 and 250/250 synthetic responses",()=>{
 assert.equal(hasCompleteIdList([{id:"r1"}],1,250),true);
 const rows=Array.from({length:250},(_,i)=>({id:"test-"+i}));
 assert.equal(hasCompleteIdList(rows,250,250),true);
});

test("Build128 list rejects caps, omitted count or truncated rows",()=>{
 assert.equal(hasCompleteIdList([{id:"r1"}],251,250),false);
 assert.equal(hasCompleteIdList([{id:"r1"}],2,250),false);
 assert.equal(hasCompleteIdList([{id:"r1"}],null,250),false);
 assert.equal(hasCompleteIdList([{id:"r1"}],undefined,250),false);
});

test("Build128 list rejects negative, fractional and infinite server counts",()=>{
 for(const n of [-1,NaN,Infinity,1.5,"1"])assert.equal(hasCompleteIdList([{id:"r1"}],n,250),false);
});

test("Build128 list rejects invalid count limit",()=>{
 for(const cap of [0,-1,1.5,NaN,Infinity])assert.equal(hasCompleteIdList([],0,cap),false);
});

test("Build128 list rejects duplicate, empty and nonstring row IDs",()=>{
 const data=[
  [{id:"x"},{id:"x"}],
  [{id:""}],
  [{id:"   "}],
  [{id:123}],
  [{other:"x"}],
  [null],
  [[]],
  ["x"],
 ];
 for(const rows of data)assert.equal(hasCompleteIdList(rows,rows.length,250),false);
});

test("Build128 list refuses non-array and incomplete payloads",()=>{
 for(const rows of [null,{},undefined,"[]"])assert.equal(hasCompleteIdList(rows,0,250),false);
});

test("Build128 list prevents profile and role mismatches before rendering",()=>{
 assert.equal(canMountApprovedCrm("account-a",approved,"admin"),true);
 for(const role of ["guest",null,undefined])assert.equal(canMountApprovedCrm("account-a",approved,role),false);
 for(const profile of [null,{...approved,id:"account-b"},{...approved,status:"suspended"},{...approved,is_active:false}])
  assert.equal(canMountApprovedCrm("account-a",profile,"admin"),false);
});

test("Build128 shared CRUD UI is keyed to exact approved subject, role and table",()=>{
 assert(ui.includes("canMountApprovedCrm(user?.id, profile, role)"));
 assert(ui.includes('key={user!.id + ":" + role + ":" + props.table}'));
 assert(ui.includes("function VerifiedCrudWorkspace("));
});

test("Build128 record lists retain count verification after Build131 page-based scale-up",()=>{
 assert(ui.includes('select("*", { count: "exact" })'));
 assert(ui.includes("readCompleteCrmRows((from, to, signal) =>"));
 assert(ui.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(ui.includes("sortCompleteCrmRows(data"));
 assert(!ui.includes(".limit(MAX_CRUD_ROWS)"));
});

test("Build128 relation choices stay exact-count verified after Build131 page-based scale-up",()=>{
 assert(ui.includes('select(field.relation!.select ?? "*", { count: "exact" })'));
 assert(ui.includes("readCompleteCrmRows((from, to, signal) =>"));
 assert(ui.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(ui.includes("setRelationsFailed(true)"));
 assert(!ui.includes(".limit(MAX_RELATION_ROWS)"));
});

test("Build128 old unfiltered all-table realtime subscriptions are gone",()=>{
 assert(!ui.includes("supabase.channel("));
 assert(!ui.includes('.on("postgres_changes"'));
 assert(!ui.includes("supabase.removeChannel"));
});

test("Build128 stale or overlapping list and relation reads are aborted",()=>{
 assert(ui.includes("rowsController.current?.abort()"));
 assert(ui.includes("relationController.current?.abort()"));
 assert(ui.includes("epoch !== rowsEpoch.current"));
 assert(ui.includes("epoch === relationEpoch.current"));
 assert(ui.includes("rowsEpoch.current++"));
 assert(ui.includes("relationEpoch.current++"));
});

test("Build128 clearing a list also discards stale personal dialogs and selections",()=>{
 for(const s of ["setRows([])","setSelected(new Set())","setMailingRow(null)","setViewing(null)",
                 "setEditing(null)","setOpen(false)","setForm({})"])
  assert(ui.includes(s),s);
});

test("Build128 user can manually refresh rather than subscribe to all business events",()=>{
 assert(ui.includes("Refresh records"));
 assert(ui.includes("void load(); void loadRelations();"));
 assert(ui.includes("disabled={loading}"));
});

test("Build128 incomplete data cannot be misreported as valid CSV exports",()=>{
 assert(ui.includes("No partial results or exports are shown."));
 assert(ui.includes("setRows([])"));
 assert(ui.includes("setLoadFailed(true)"));
 assert(ui.includes("setRelationOptions({})"));
});

test("Build128 server-generated errors are not displayed raw in affected CRUD reads/writes",()=>{
 assert(!ui.includes("toast.error(error.message)"));
 assert(!ui.includes("toast.error(error?.message"));
 assert(ui.includes("Update not confirmed; check permissions and refresh before retrying."));
 assert(ui.includes("Creation not confirmed; inspect records before retrying."));
});

test("Build128 candidate, billing and joined-finance mutation holds remain",()=>{
 for(const x of ["LEGACY_CANDIDATE_WRITES_PAUSED","LEGACY_BILLING_MUTATIONS_PAUSED",
                 "LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED","bulkMutationPending.current"])
  assert(ui.includes(x),x);
});

test("Build128 data query is still dependent on RLS and does not assert server authorization",()=>{
 assert(ui.includes("not server RLS"));
 assert(ui.includes("server-side role and row authorization contract"));
 assert(!ui.includes("service_role"));
});
