import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 WORKFLOW_RULE_MUTATIONS_HELD,
 validateWorkflowReviewRows,
} from "../../src/lib/workflow-rules-review.ts";
import { readCompleteCrmRows } from "../../src/lib/bounded-crm-read.ts";
import { canReadPrivateUserDirectory } from "../../src/lib/crm-sensitive-route-access.ts";

const source = file => readFileSync(new URL("../../"+file,import.meta.url),"utf8");
const page=source("src/routes/_app.workflow-rules.tsx");
const profile={id:"person-1",status:"approved",is_active:true};
const record=(id="rule-1")=>({
 id,name:"Do nothing",table_name:"candidates",field_name:"stage",
 field_value:"interview_completed",action_type:"notify",
 notify_target:"role:admin",update_field_name:null,update_field_value:null,
 is_active:false,created_at:"2026-11-14T07:00:00Z",
});
const reader=data=>async(from,to)=>({data:data.slice(from,to+1),count:data.length,error:null});

test("Build133 workflow activation is unconditionally held",()=>{
 assert.equal(WORKFLOW_RULE_MUTATIONS_HELD,true);
 const helper=source("src/lib/workflow-rules-review.ts");
 assert(helper.includes("WORKFLOW_RULE_MUTATIONS_HELD = true as const"));
 for(const marker of ["process.env","import.meta.env","localStorage","sessionStorage","setTimeout(","supabase.from","service_role"])
  assert(!helper.includes(marker),marker);
});

test("Build133 only exact approved administrator can mount workflow rule review",()=>{
 assert.equal(canReadPrivateUserDirectory("person-1",profile,"admin"),true);
 for(const role of ["recruiter","operations","finance","viewer",null,undefined,""])
  assert.equal(canReadPrivateUserDirectory("person-1",profile,role),false,role);
 for(const wrong of [null,undefined,"person-2",""])
  assert.equal(canReadPrivateUserDirectory(wrong,profile,"admin"),false);
 for(const status of ["suspended","pending","rejected"])
  assert.equal(canReadPrivateUserDirectory("person-1",{...profile,status},"admin"),false);
 assert.equal(canReadPrivateUserDirectory("person-1",{...profile,is_active:false},"admin"),false);
});

test("Build133 direct navigation rejects unverifiable role before mounting private hooks",()=>{
 const gate=page.indexOf("if (loading || !canReadPrivateUserDirectory(user?.id, profile, role))");
 const mount=page.indexOf("return <AdminWorkflowReview key=");
 assert(gate>=0&&mount>gate);
 assert(page.includes('key={user!.id + ":" + role}'));
 assert(!page.includes('if (role && role !== "admin")'));
});

test("Build133 route is truly read only: no direct client mutation SQL",()=>{
 for(const stmt of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(",
 "supabase.auth.getUser()", "createSchedulingLink", "run_workflow_rules"])
  assert(!page.includes(stmt),stmt);
 assert(!page.includes("toggleActive"));
 assert(!page.includes("const save ="));
 assert(!page.includes("const remove ="));
 assert(!page.includes("<Dialog"));
 assert(!page.includes("<Switch"));
});

test("Build133 no Create/Edit/Activate/Delete controls or setter functions remain",()=>{
 assert(!page.includes("New Rule"));
 assert(!page.includes("Create rule"));
 assert(!page.includes("Save changes"));
 assert(!page.includes("onCheckedChange"));
 assert(!page.includes("openEdit("));
 assert(page.includes("WORKFLOW_RULE_MUTATIONS_HELD &&"));
 assert(page.includes("cannot change existing rules or stop server-side triggers"));
});

test("Build133 route downloads only reviewed rule metadata, not raw message templates",()=>{
 const prefix='select("id, name, table_name, field_name, field_value, action_type, notify_target, update_field_name, update_field_value, is_active, created_at", { count: "exact" })';
 assert(page.includes(prefix));
 assert(!page.includes('.select("*")'));
 assert(!page.includes("notify_message"));
 assert(!page.includes("notify_title"));
 assert(!page.includes("created_by"));
});

test("Build133 row validation accepts complete typed notify and update rules",()=>{
 const a=record();
 const b={...record("rule-2"),action_type:"update_field",
  update_field_name:"status",update_field_value:"on_hold",notify_target:null,is_active:true};
 const rows=[a,b];
 assert.strictEqual(validateWorkflowReviewRows(rows),rows);
 assert.deepEqual(validateWorkflowReviewRows([]),[]);
 assert.equal(validateWorkflowReviewRows(null),null);
});

test("Build133 validation rejects absent, nonarray, and malformed rule pages",()=>{
 for(const candidate of [undefined,"",{},0,true,[],null]){
  if(candidate===null||Array.isArray(candidate))continue;
  assert.throws(()=>validateWorkflowReviewRows(candidate),/incomplete or malformed/);
 }
});

test("Build133 validation rejects missing numeric and whitespace identifiers",()=>{
 for(const id of ["","  ",null,undefined,1,0])assert.throws(
  ()=>validateWorkflowReviewRows([{...record(),id}]),/incomplete or malformed/);
});

test("Build133 validation refuses unknown action types, not a plausible workflow",()=>{
 for(const action_type of ["",null,"shell","send_email","delete_record",1])
  assert.throws(()=>validateWorkflowReviewRows([{...record(),action_type}]),/incomplete or malformed/);
});

test("Build133 validation refuses non-boolean activation status",()=>{
 for(const is_active of [1,0,"true",null,undefined])
  assert.throws(()=>validateWorkflowReviewRows([{...record(),is_active}]),/incomplete or malformed/);
});

test("Build133 validation rejects corrupt notification target and update field labels",()=>{
 for(const value of [42,{},false]){
  assert.throws(()=>validateWorkflowReviewRows([{...record(),notify_target:value}]));
  assert.throws(()=>validateWorkflowReviewRows([{...record(),update_field_name:value}]));
  assert.throws(()=>validateWorkflowReviewRows([{...record(),update_field_value:value}]));
 }
});

test("Build133 valid empty complete read shows genuinely empty permitted directory",async()=>{
 const x=await readCompleteCrmRows(reader([]),new AbortController().signal);
 assert.deepEqual(x,[]);
 assert(page.includes("No role-visible rules were returned by a verified complete read."));
});

test("Build133 251 rules page correctly rather than hiding a valid admin list",async()=>{
 const records=Array.from({length:251},(_,i)=>record(String(i).padStart(5,"0")));
 let calls=0;
 const query=async(from,to)=>{calls++;return{data:records.slice(from,to+1),count:records.length,error:null}};
 const rows=await readCompleteCrmRows(query,new AbortController().signal);
 assert.equal(rows.length,251);
 assert.equal(calls,2);
});

test("Build133 over-limit 2501 rules are withheld rather than partially displayed",async()=>{
 const rows=Array.from({length:2501},(_,i)=>record(String(i).padStart(5,"0")));
 await assert.rejects(readCompleteCrmRows(reader(rows),new AbortController().signal),/exceeds verified row limit/);
});

test("Build133 changed count rejects a plausible but drifting rule catalogue",async()=>{
 const records=Array.from({length:251},(_,i)=>record(String(i).padStart(5,"0")));
 let n=0;const query=async(from,to)=>({
  data:records.slice(from,to+1),count:++n===1?251:252,error:null
 });
 await assert.rejects(readCompleteCrmRows(query,new AbortController().signal),/changed while reading/);
});

test("Build133 overlapping rule IDs fail closed instead of showing duplicate automation",async()=>{
 const data=Array.from({length:251},(_,i)=>record(String(i).padStart(5,"0")));
 data[250].id=data[249].id;
 await assert.rejects(readCompleteCrmRows(reader(data),new AbortController().signal),/order\/identity/);
});

test("Build133 current Auth subject request aborts and clears on unmount",()=>{
 assert(page.includes("const controller = new AbortController()"));
 assert(page.includes("let active = true"));
 assert(page.includes("return () => { active = false; controller.abort(); }"));
 assert(page.includes("setRows([]);"));
 assert(page.includes("setFailed(true);"));
 assert(page.includes("if (active && !controller.signal.aborted) setRows(data)"));
});

test("Build133 workflow review never treats read failure as zero rules",()=>{
 assert(page.includes('failed ? "Workflow data unavailable"'));
 assert(page.includes("No partial rules are shown."));
 assert(page.includes("setFailed(true);"));
});

test("Build133 manual refresh is the only data requery, not unscoped realtime",()=>{
 assert(page.includes("setReloadKey(k => k + 1)"));
 assert(page.includes("}, [reloadKey]);"));
 assert(!page.includes("supabase.channel("));
 assert(!page.includes('.on("postgres_changes"'));
});

test("Build133 caller retains trigger/finance hold and no server activation claim",()=>{
 assert(page.includes("Existing server-side rules may still execute"));
 assert(page.includes("financial approval"));
 assert(page.includes("No background subscriptions or rule writes"));
 const prod=source(".github/workflows/security-build34-review.yml");
 assert(prod.includes("production-release-hold:"));
 assert(prod.includes("exit 1"));
});
