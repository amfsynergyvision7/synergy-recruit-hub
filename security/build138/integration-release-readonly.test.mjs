import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED,
 CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED,
 CRM_INTEGRATION_MUTATION_HOLD_REASON
} from "../../src/lib/release-safety.ts";
import {assertExternalEffectReleased} from "../../src/lib/external-effects-hold.server.ts";
import {sanitizeStoredSyncLogs} from "../../src/lib/sync-safety.ts";
import {canReadPrivateUserDirectory} from "../../src/lib/crm-sensitive-route-access.ts";

const file=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const ui=file("src/routes/_app.integrations.tsx");
const server=file("src/lib/integrations.functions.ts");
const history=file("src/lib/sheets-sync.server.ts");
const safety=file("src/lib/release-safety.ts");
const section=(source,a,b)=>{
 const i=source.indexOf(a),j=source.indexOf(b,i+a.length);
 assert(i>=0&&j>i,a+" / "+b);
 return source.slice(i,j);
};

test("Build138 integration and candidate sync browser holds are unconditional true",()=>{
 assert.equal(CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED,true);
 assert.equal(CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED,true);
 assert.match(CRM_INTEGRATION_MUTATION_HOLD_REASON,/paused pending/);
 assert(safety.includes("CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED = true as const"));
 assert(safety.includes("CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED = true as const"));
 assert(!safety.includes("VITE_CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED"));
});

test("Build138 server side release holds remain unconditionally enforced",()=>{
 assert.throws(()=>assertExternalEffectReleased("integration_configuration"),/paused/);
 assert.throws(()=>assertExternalEffectReleased("candidate_sync"),/paused/);
 for(const [handler,action] of [["saveIntegration","integration_configuration"],
   ["detectHeaders","integration_configuration"],["triggerSync","candidate_sync"]]){
  const start=server.indexOf("export const "+handler);
  assert(start>=0);
  const block=server.slice(start,server.indexOf("export const ",start+12));
  assert(block.includes('assertExternalEffectReleased("'+action+'")'),handler);
  assert(block.indexOf("assertExternalEffectReleased")<block.indexOf("await assertAdminUser"),handler);
 }
});

test("Build138 browser verified-administrator gate precedes all integration hooks",()=>{
 assert(ui.includes("canReadPrivateUserDirectory(user?.id, profile, role)"));
 assert(ui.includes('return <AdminIntegrationWorkspace key={user!.id + ":" + role} userId={user!.id} />'));
 assert(ui.indexOf("canReadPrivateUserDirectory(user?.id, profile, role)") <
        ui.indexOf("function AdminIntegrationWorkspace"));
 assert.equal(canReadPrivateUserDirectory("a",{id:"a",status:"approved",is_active:true},"admin"),true);
 assert.equal(canReadPrivateUserDirectory("a",{id:"a",status:"approved",is_active:true},"recruiter"),false);
});

test("Build138 save mutation checks browser hold BEFORE any server request",()=>{
 const block=section(ui,"const saveMut = useMutation","const ensureSaved");
 assert(block.includes("if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)"));
 assert(block.indexOf("if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)") <
        block.indexOf("return save({ data:"));
});

test("Build138 header detection checks hold BEFORE URL lookup or save",()=>{
 const block=section(ui,"const detectMut = useMutation","const syncMut");
 assert(block.includes("if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)"));
 assert(block.indexOf("if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)") <
        block.indexOf("await ensureSaved()"));
 assert(block.indexOf("await ensureSaved()")<block.indexOf("return detect({"));
});

test("Build138 candidate sync checks BOTH integration and sync holds BEFORE any request",()=>{
 const block=section(ui,"const syncMut = useMutation","const hasValidUrl");
 assert(block.includes("if (CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED ||"));
 assert(block.includes("CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)"));
 assert(block.indexOf("CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED") <
        block.indexOf("await ensureSaved()"));
 assert(block.indexOf("await ensureSaved()")<block.indexOf("return sync({"));
});

test("Build138 paused integration forms cannot suggest editable saved data",()=>{
 for(const val of [
  "disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={form.sheet_url}",
  "disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={form.sheet_name}",
  'disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} type="number"',
  'disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={mapping[h]',
  "disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED || !canSync || detectMut.isPending}",
  "disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED || saveMut.isPending}"
 ])assert(ui.includes(val),val);
});

test("Build138 old client URL and sync error messages are never rendered",()=>{
 assert(ui.includes('"Configured (link withheld)"'));
 assert(ui.includes("Failure details withheld pending privacy review"));
 assert(!ui.includes("diagnostics.fetchedSheetUrl ||"));
 assert(!ui.includes("e.message ??"));
 assert(!ui.includes("l.errors.map("));
 assert(!ui.includes("toast.error(error.message)"));
});

test("Build138 user sees a truthful verification state instead of zero sync rows on error",()=>{
 assert(ui.includes('const logsVerified = !logsQ.isPending && !logsQ.isError && Array.isArray(logsQ.data)'));
 assert(ui.includes('logsVerified && logs.length === 0'));
 assert(ui.includes("Restricted sync history unavailable. No empty-history claim is made."));
 assert(ui.includes("No role-visible sync runs in this verified recent-history preview."));
 assert(ui.includes("Verifying restricted sync history…"));
 assert(ui.includes('key={l.id ?? `legacy-sanitized-${index}`}'));
});

test("Build138 server selects only sanitized sync history columns from privileged connection",()=>{
 const block=section(history,"export async function getCandidateSyncLogs()","export async function fetchSheetValues");
 assert(block.includes('from("sync_logs")'));
 assert(block.includes('.select("id, module, triggered_by, rows_scanned, rows_created, rows_updated, rows_skipped, errors, status, created_at")'));
 assert(block.includes('.order("created_at", { ascending: false })'));
 assert(block.includes('.order("id", { ascending: true })'));
 assert(block.includes('.limit(50)'));
 assert(!block.includes('.select("*")'));
 assert(block.includes("return sanitizeStoredSyncLogs(data ?? [])"));
 assert(block.includes('throw new Error("Sync log retrieval unavailable")'));
});

test("Build138 sanitized historic sync failures do not disclose raw PII or provider URLs",()=>{
 const email="not-a-real-candidate@private.invalid",token="Bearer testing_dont_copy";
 const data=[{id:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
   module:"candidates",triggered_by:"manual",rows_scanned:2,rows_created:0,
   rows_updated:0,rows_skipped:2,created_at:"2026-11-14T00:00:00Z",
   status:"error",errors:[{row:1,message:email+" "+token}],
   sheet_url:"https://docs.google.com/spreadsheets/d/sensitive-but-fictional/edit"}];
 const out=sanitizeStoredSyncLogs(data);
 assert.equal(out.length,1);
 assert.equal(out[0].status,"error");
 assert.equal(out[0].rows_scanned,2);
 const serialized=JSON.stringify(out);
 for(const secret of [email,token,"sensitive-but-fictional"])
  assert(!serialized.includes(secret));
});

test("Build138 latest sync history never claims to be a complete audit history",()=>{
 assert(ui.includes("Most recent 50 runs. Refresh manually; no background polling."));
 assert(!ui.includes("Complete sync audit history"));
 assert(ui.includes("Refresh history"));
});

test("Build138 no browser service role, direct candidate DML or network sync bypass",()=>{
 for(const bad of ["service_role","supabase.from(\"candidates\").insert(",
 "supabase.from(\"candidates\").update(","process.env.SHEETS_SYNC_CRON_ENABLED"])
   assert(!ui.includes(bad),bad);
});
