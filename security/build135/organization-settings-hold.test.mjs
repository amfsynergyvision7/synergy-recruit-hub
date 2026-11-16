import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CRM_ORG_SETTINGS_MUTATIONS_PAUSED, CRM_ORG_SETTINGS_HOLD_REASON } from "../../src/lib/release-safety.ts";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const settings=read("src/routes/_app.settings.tsx");
const rpc=read("src/lib/admin-settings.ts");
const self=read("src/lib/profile-settings.ts");
const users=read("src/lib/user-administration.ts");

const section=(start,end)=>{
 const a=settings.indexOf(start);
 const b=settings.indexOf(end,a+start.length);
 assert(a>=0&&b>a,start);
 return settings.slice(a,b);
};

test("Build135 organization-wide branding and settings have an unconditional draft hold",()=>{
 assert.equal(CRM_ORG_SETTINGS_MUTATIONS_PAUSED,true);
 assert.match(CRM_ORG_SETTINGS_HOLD_REASON,/independently reviewed/);
 const safety=read("src/lib/release-safety.ts");
 assert(safety.includes("CRM_ORG_SETTINGS_MUTATIONS_PAUSED = true as const"));
 assert(!safety.includes("CRM_ORG_SETTINGS_MUTATIONS_PAUSED = import.meta.env"));
});

test("Build135 admin settings helper refuses write before invoking hosted RPC",()=>{
 const fn=rpc.slice(rpc.indexOf("export async function updateAdminSetting("));
 assert(fn.includes("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)"));
 assert(fn.includes("return { error: { message: CRM_ORG_SETTINGS_HOLD_REASON } }"));
 assert(fn.indexOf("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)")<fn.indexOf('rpcClient.rpc("crm_admin_update_setting"'));
 assert(!rpc.includes("service_role"));
});

test("Build135 read-only admin resume folder lookup remains available",()=>{
 assert(rpc.includes('rpcClient.rpc("crm_admin_get_resume_folder")'));
 assert(rpc.indexOf('rpcClient.rpc("crm_admin_get_resume_folder")')<
        rpc.indexOf("export async function updateAdminSetting("));
});

test("Build135 logo uploader checks hold before reading file bytes or writing storage",()=>{
 const block=section("const uploadLogo = async (file: File)", "const setOrgDefaultTheme");
 assert(block.includes("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)"));
 assert(block.indexOf("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)")<block.indexOf("file.slice(0, 16).arrayBuffer()"));
 assert(block.indexOf("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)")<block.indexOf('.from("branding")'));
 assert(block.includes("verifyLogoSignature(file.type, file.size, signature)"));
});

test("Build135 logo deletion checks hold before removing any storage object",()=>{
 const block=section("const removeLogo = async", "return (");
 assert(block.includes("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)"));
 assert(block.indexOf("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)")<block.indexOf('.from("branding").remove('));
});

test("Build135 public organization theme updates check hold before RPC",()=>{
 const block=section("const setOrgDefaultTheme = async", "const removeLogo");
 assert(block.includes("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)"));
 assert(block.indexOf("if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)")<block.indexOf('updateAdminSetting("default_color_theme"'));
});

test("Build135 organization theme control is disabled while local preference is unaffected",()=>{
 assert(settings.includes('isAdmin={role === "admin" && !CRM_ORG_SETTINGS_MUTATIONS_PAUSED}'));
 assert(settings.includes('onSetOrgDefault={role === "admin" && !CRM_ORG_SETTINGS_MUTATIONS_PAUSED ? setOrgDefaultTheme : undefined}'));
 assert(settings.includes("<ThemePicker"));
 assert(settings.includes("orgDefault={defaultColorTheme}"));
});

test("Build135 branding storage buttons are both visibly disabled",()=>{
 assert(settings.includes('disabled={uploading || CRM_ORG_SETTINGS_MUTATIONS_PAUSED} onClick={() => fileInputRef.current?.click()}'));
 assert(settings.includes('disabled={uploading || CRM_ORG_SETTINGS_MUTATIONS_PAUSED} onClick={removeLogo}'));
 assert(settings.includes("Organization branding is read-only until the storage and admin-setting permissions receive independent release approval."));
});

test("Build135 profile edits are hard-disabled regardless of a frontend build variable",()=>{
 assert(self.includes("CRM_PROFILE_MUTATIONS_ENABLED = false as const"));
 assert(!self.includes("import.meta.env.VITE_CRM_PROFILE_MUTATIONS_ENABLED"));
 assert(self.includes("if (!CRM_PROFILE_MUTATIONS_ENABLED)"));
 assert(settings.includes("disabled={!CRM_PROFILE_MUTATIONS_ENABLED}"));
});

test("Build135 user role, activity and approval mutations remain hard-held",()=>{
 assert(users.includes("CRM_USER_ADMIN_MUTATIONS_ENABLED = false as const"));
 assert(!users.includes("import.meta.env.VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED"));
 assert(users.includes("if (!CRM_USER_ADMIN_MUTATIONS_ENABLED)"));
});

test("Build135 independent candidate, billing, outbound email holds stay unconditionally set",()=>{
 const safety=read("src/lib/release-safety.ts");
 for(const name of ["LEGACY_CANDIDATE_WRITES_PAUSED","LEGACY_BILLING_MUTATIONS_PAUSED",
 "LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED","CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED",
 "LEGACY_BULK_IMPORT_WRITES_PAUSED"])
   assert(safety.includes(name+" = true as const"),name);
});

test("Build135 branding UI uses no direct app settings table writes or service role key",()=>{
 assert(!settings.includes('supabase.from("app_settings").update('));
 assert(!settings.includes("service_role"));
 assert(!rpc.includes('supabase.from("app_settings").update('));
 assert(!rpc.includes("process.env"));
});
