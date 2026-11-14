import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReadPrivateUserDirectory } from "../../src/lib/crm-sensitive-route-access.ts";
import { canMountApprovedCrm } from "../../src/lib/crm-shell-access.ts";

const src=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const integ=src("src/routes/_app.integrations.tsx");
const settings=src("src/routes/_app.settings.tsx");
const profile={id:"auth-1",status:"approved",is_active:true};

test("Build129 integrations only admits an exact active approved admin",()=>{
 assert.equal(canReadPrivateUserDirectory("auth-1",profile,"admin"),true);
 for(const role of [null,"viewer","finance","recruiter","operations","Admin"])
  assert.equal(canReadPrivateUserDirectory("auth-1",profile,role),false,role);
 for(const p of [null,{...profile,id:"auth-2"},{...profile,is_active:false},
                 {...profile,status:"suspended"},{...profile,status:"pending"}])
  assert.equal(canReadPrivateUserDirectory("auth-1",p,"admin"),false);
});

test("Build129 integrations Page checks loading, identity and active role before server-backed hooks",()=>{
 assert(integ.includes("const { user, profile, role, loading } = useAuth()"));
 assert(integ.includes("if (loading) return"));
 assert(integ.includes("if (!canReadPrivateUserDirectory(user?.id, profile, role))"));
 const route=integ.indexOf("function Page()"), workspace=integ.indexOf("function AdminIntegrationWorkspace(");
 const hook=integ.indexOf("const integQ = useQuery(");
 assert(route>=0 && workspace>route && hook>workspace);
 assert(integ.includes('<AdminIntegrationWorkspace key={user!.id + ":" + role} userId={user!.id} />'));
 assert(!integ.includes('if (role && role !== "admin")'));
});

test("Build129 integration React Query cache partitions all private keys by verified user",()=>{
 assert(integ.includes('queryKey: ["integration", userId]'));
 assert(integ.includes('queryKey: ["sync-logs", userId]'));
 assert(integ.includes('qc.setQueryData(["integration", userId], row)'));
 assert(integ.includes('qc.invalidateQueries({ queryKey: ["integration", userId] })'));
 assert(integ.includes('qc.invalidateQueries({ queryKey: ["sync-logs", userId] })'));
 assert(!integ.includes('queryKey: ["integration"]'));
 assert(!integ.includes('queryKey: ["sync-logs"]'));
});

test("Build129 server integration endpoints still enforce administrator and external effect hold",()=>{
 const api=src("src/lib/integrations.functions.ts");
 assert(api.includes("requireSupabaseAuth"));
 assert(api.includes("await assertAdminUser(context.userId)"));
 assert(api.includes('assertExternalEffectReleased("integration_configuration")'));
 assert(api.includes('assertExternalEffectReleased("candidate_sync")'));
 assert(api.includes('process.env.CANDIDATE_SYNC_MANUAL_ENABLED !== "true"'));
});

test("Build129 settings allows any verified CRM role, not anonymous or suspended",()=>{
 assert.equal(canMountApprovedCrm("auth-1",profile,"viewer"),true);
 assert.equal(canMountApprovedCrm("auth-1",profile,"admin"),true);
 for(const p of [null,{...profile,id:"auth-2"},{...profile,is_active:false},{...profile,status:"pending"}])
  assert.equal(canMountApprovedCrm("auth-1",p,"viewer"),false);
 assert.equal(canMountApprovedCrm(null,profile,"admin"),false);
});

test("Build129 settings profile and private branding state mount after approved CRM gate",()=>{
 assert(settings.includes("const { user, profile, role, loading } = useAuth()"));
 assert(settings.includes("if (loading) return"));
 assert(settings.includes("if (!canMountApprovedCrm(user?.id, profile, role))"));
 assert(settings.includes('<ApprovedSettingsWorkspace key={user!.id + ":" + role} />'));
 assert(settings.indexOf("function ApprovedSettingsWorkspace(")>settings.indexOf("if (!canMountApprovedCrm"));
 assert(settings.indexOf("useState({")>settings.indexOf("function ApprovedSettingsWorkspace("));
});

test("Build129 delayed admin settings read does not repopulate a signed-out view",()=>{
 assert(settings.includes("let active = true"));
 assert(settings.includes("if (active && !error) setDriveFolderUrl("));
 assert(settings.includes("return () => { active = false; }"));
});

test("Build129 settings suppresses raw database and storage errors in affected paths",()=>{
 assert(!settings.includes("toast.error(error.message)"));
 assert(!settings.includes("toast.error(dbError.message)"));
 assert(!settings.includes("toast.error(uploadError.message)"));
 assert(settings.includes("Settings update could not be verified."));
 assert(settings.includes("Logo upload could not be verified."));
 assert(settings.includes("Branding update could not be verified."));
});

test("Build129 settings admin controls remain limited to verified administrator",()=>{
 assert(settings.includes('if (role !== "admin") return;'));
 assert(settings.includes('isAdmin={role === "admin" && !CRM_ORG_SETTINGS_MUTATIONS_PAUSED}'));
 assert(settings.includes('{role === "admin" && ('));
});

test("Build129 profile, import and external effect mutation holds remain",()=>{
 assert(settings.includes("CRM_PROFILE_MUTATIONS_ENABLED"));
 assert(settings.includes("LEGACY_BULK_IMPORT_WRITES_PAUSED"));
 assert(integ.includes('toast.error("Candidate synchronization unavailable; check restricted logs")'));
});

test("Build129 admin-only integration log refresh has no 10-second background polling",()=>{
 assert(!integ.includes("refetchInterval: 10000"));
 assert(integ.includes('queryKey: ["sync-logs", userId]'));
 assert(integ.includes("Refresh history"));
 assert(integ.includes("void logsQ.refetch();"));
 assert(integ.includes("disabled={logsQ.isFetching}"));
 assert(integ.includes("no background polling"));
});

test("Build129 integrations accurately disclose inactive external synchronization",()=>{
 assert(integ.includes("External synchronization is paused pending release approval."));
 assert(!integ.includes("Auto-sync runs every 2 minutes."));
 assert(integ.includes("Scheduled sync remains inactive until release approval"));
 assert(integ.includes("Manual candidate sync requires release approval"));
});
