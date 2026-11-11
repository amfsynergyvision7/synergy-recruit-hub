import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync('src/routes/_app.settings.tsx','utf8');
const helper=readFileSync('src/lib/admin-settings.ts','utf8');
const branding=readFileSync('src/hooks/use-branding.tsx','utf8');
const sql=readFileSync('security/build40/admin-settings-rpc-review-only.sql','utf8');
test('settings screen uses protected helper for private folder read',()=>{
 assert.match(app,/getAdminResumeFolder\(\)/);
 assert.doesNotMatch(app,/\.from\("app_settings"\)/);
});
test('settings screen uses four named protected write calls',()=>{
 assert.equal((app.match(/await updateAdminSetting\(/g)||[]).length,4);
 for(const name of ['logo_url','default_color_theme','resume_import_folder_url']) assert.ok(app.includes('updateAdminSetting("'+name+'"'));
});
test('direct profile edit remains independent',()=>assert.match(app,/\.from\("profiles"\)\.update\(form\)/));
test('unauthenticated login branding needs only public columns',()=>assert.match(branding,/\.select\("logo_url, default_color_theme"\)/));
test('private read and update RPC names are explicit',()=>{
 assert.match(helper,/crm_admin_get_resume_folder/);
 assert.match(helper,/crm_admin_update_setting/);
 assert.doesNotMatch(helper,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('admin SQL is security-definer with fixed path',()=>{
 assert.equal((sql.match(/SECURITY DEFINER SET search_path=pg_catalog,public/g)||[]).length,2);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION .* FROM PUBLIC,anon/);
});
test('approved and active admin role required for both RPCs',()=>{
 assert.equal((sql.match(/public\.is_approved\(v_uid\)/g)||[]).length,2);
 assert.equal((sql.match(/public\.has_role\(v_uid,'admin'::public\.app_role\)/g)||[]).length,2);
});
test('admin update only allows explicitly named settings',()=>{
 for(const key of ['logo_url','default_color_theme','resume_import_folder_url'])assert.ok(sql.includes("p_key='"+key+"'"));
 assert.doesNotMatch(sql,/EXECUTE\s+format\(/);
});
test('RLS helper cannot be invoked anonymously after function grants',()=>assert.match(sql,/GRANT EXECUTE ON FUNCTION .* TO authenticated/));

test('Drive importer uses protected admin-only folder RPC',()=>{
 const code=readFileSync('src/lib/drive-import.server.ts','utf8');
 assert.match(code,/\.rpc\("crm_admin_get_resume_folder"\)/);
 assert.doesNotMatch(code,/\.from\("app_settings"\)/);
 const handler=readFileSync('src/lib/ai.functions.ts','utf8');
 assert.match(handler,/await assertApprovedRole\(context\.userId, \["admin"\]\);\s*return runResumeDriveImport\(context\.supabase, context\.userId\)/);
 assert.match(code,/Drive bulk import paused pending transactional idempotency approval/);
});
