import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const admin=read('security/build49/user-admin-rpc-review-only.sql');
const self=read('security/build49/self-profile-rpc-review-only.sql');
const all=read('security/build49/67-policy-plus-account-rpcs-review-only.sql');
const adminSql=read('security/build49/user-admin-transaction.integration.sql');
const selfSql=read('security/build49/self-profile-transaction.integration.sql');
const fullSql=read('security/build49/67-policy-admin-profile-compat.integration.sql');
const userHelper=read('src/lib/user-administration.ts');
const profileHelper=read('src/lib/profile-settings.ts');
const users=read('src/routes/_app.users.tsx');
const settings=read('src/routes/_app.settings.tsx');

test('admin SQL derives verified actor from auth.uid instead of arbitrary request user ID',()=>{
 assert.match(admin,/v_actor uuid := auth\.uid\(\)/);
 assert.doesNotMatch(admin,/p_actor uuid/);
 assert.match(admin,/p_target uuid/);
});
test('admin RPC is a SECURITY DEFINER with an explicit safe search path',()=>{
 assert.match(admin,/SECURITY DEFINER SET search_path=pg_catalog,public/);
 assert.match(admin,/crm_admin_manage_user/);
});
test('only approved active admin role can perform role/status mutations',()=>{
 assert.match(admin,/p\.id=v_actor AND p\.status='approved'/);
 assert.match(admin,/p\.is_active IS TRUE AND r\.role='admin'/);
});
test('self-lockout, last active admin and concurrent demotion are guarded',()=>{
 assert.match(admin,/p_target=v_actor/);
 assert.match(admin,/Self administration is prohibited/);
 assert.match(admin,/Cannot revoke the last active administrator/);
 assert.match(admin,/pg_advisory_xact_lock\(hashtextextended\('crm_admin_role_and_status',0\)\)/);
});
test('status, activity and role operations are all strictly enumerated',()=>{
 for(const action of ['set_status','set_active','set_role'])
  assert.ok(admin.includes("'"+action+"'"));
 assert.match(admin,/Unsupported account status/);
 assert.match(admin,/Activation must be true or false/);
 assert.match(admin,/Unsupported account role/);
});
test('administration role replacement and audit insertion are one transaction',()=>{
 assert.match(admin,/DELETE FROM public\.user_roles WHERE user_id=p_target/);
 assert.match(admin,/INSERT INTO public\.user_roles\(user_id,role\)/);
 assert.match(admin,/INSERT INTO public\.audit_logs\(user_id,action,table_name,record_id,details\)/);
 assert.match(admin,/old_roles/);assert.match(admin,/new_roles/);
});
test('audit metadata does not include names, email or phone values',()=>{
 assert.match(admin,/jsonb_build_object\('operation',p_operation,'new_value',p_value/);
 assert.doesNotMatch(admin,/jsonb_build_object\([^;]*email/s);
 assert.doesNotMatch(admin,/jsonb_build_object\([^;]*phone/s);
});
test('administration SQL is executable only by authenticated API callers',()=>{
 assert.match(admin,/REVOKE ALL ON FUNCTION public\.crm_admin_manage_user\(uuid,text,text\)/);
 assert.match(admin,/FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(admin,/GRANT EXECUTE ON FUNCTION public\.crm_admin_manage_user\(uuid,text,text\)\s+TO authenticated/);
});
test('admin browser helper fails closed by default',()=>{
 assert.match(userHelper,/VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED === "true"/);
 assert.match(userHelper,/if \(!CRM_USER_ADMIN_MUTATIONS_ENABLED\)/);
 assert.match(userHelper,/User administration is paused pending release approval/);
});
test('admin browser helper does not accept spoofed actor principal',()=>{
 assert.match(userHelper,/p_target: change\.targetId/);
 assert.doesNotMatch(userHelper,/p_actor/);
 assert.match(userHelper,/crm_admin_manage_user/);
 assert.doesNotMatch(userHelper,/\.from\("user_roles"\)/);
});
test('user management UI uses atomic RPC and removes direct DML',()=>{
 assert.match(users,/manageCRMUser\(/);
 assert.match(users,/CRM_USER_ADMIN_MUTATIONS_ENABLED/);
 assert.doesNotMatch(users,/supabase\.from\("profiles"\)\.update\(/);
 assert.doesNotMatch(users,/supabase\.from\("user_roles"\)\.(?:delete|insert|update)\(/);
});
test('user management UI disables actions until explicitly released',()=>{
 assert.match(users,/canManageUsers = isAdmin && CRM_USER_ADMIN_MUTATIONS_ENABLED/);
 assert.match(users,/disabled=\{!canManageUsers\}/);
 assert.match(users,/User approvals and role changes are paused pending secure release/);
});
test('self-profile RPC operates only on the auth.uid profile row',()=>{
 assert.match(self,/v_actor uuid := auth\.uid\(\)/);
 assert.match(self,/WHERE p\.id=v_actor/);
 assert.doesNotMatch(self,/p_target uuid/);
});
test('self-profile SQL permits only three ordinary fields and audits without PII',()=>{
 assert.match(self,/SET full_name=v_name,phone=v_phone,department=v_department/);
 assert.doesNotMatch(self,/SET status=/);
 assert.doesNotMatch(self,/SET is_active=/);
 assert.match(self,/jsonb_build_array\('full_name','phone','department'\)/);
});
test('self profile SQL validates length and denies unknown actors',()=>{
 assert.match(self,/v_actor IS NULL/);
 assert.match(self,/length\(v_name\)>120/);
 assert.match(self,/length\(coalesce\(v_phone,''\)\)>32/);
 assert.match(self,/length\(coalesce\(v_department,''\)\)>120/);
});
test('self profile RPC is authenticated-only, with no anonymous execution',()=>{
 assert.match(self,/REVOKE ALL ON FUNCTION public\.crm_update_own_profile\(text,text,text\)/);
 assert.match(self,/GRANT EXECUTE ON FUNCTION public\.crm_update_own_profile\(text,text,text\) TO authenticated/);
});
test('self profile browser helper defaults to the release hold and uses signed session',()=>{
 assert.match(profileHelper,/VITE_CRM_PROFILE_MUTATIONS_ENABLED === "true"/);
 assert.match(profileHelper,/if \(!CRM_PROFILE_MUTATIONS_ENABLED\)/);
 assert.match(profileHelper,/crm_update_own_profile/);
 assert.doesNotMatch(profileHelper,/p_target/);
});
test('settings UI cannot use direct profiles UPDATE after lockdown',()=>{
 assert.match(settings,/updateOwnCRMProfile\(form\)/);
 assert.match(settings,/disabled=\{!CRM_PROFILE_MUTATIONS_ENABLED\}/);
 assert.doesNotMatch(settings,/supabase\.from\("profiles"\)\.update\(/);
});
test('admin synthetic rehearsal rejects unauthorised actors and restores failed audit writes',()=>{
 for(const x of ['recruiter elevated to admin','suspended admin could approve','self deactivation permitted','pending account activated','privileged admin mutation persisted despite audit failure'])
  assert.ok(adminSql.includes(x),x);
 assert.match(adminSql,/ROLLBACK;/);
});
test('self-profile rehearsal covers own fields, pending account and audit rollback',()=>{
 for(const x of ['pending status escalated','self profile edit reached another user','failed audit did not roll back profile change'])
  assert.ok(selfSql.includes(x),x);
 assert.match(selfSql,/ROLLBACK;/);
});
test('new functions run under the complete 67-to-35 restrictive policy migration',()=>{
 assert.match(fullSql,/Expected legacy approved recruiter candidate exposure 2/);
 assert.match(fullSql,/Direct profiles mutation bypassed restrictive release grants/);
 assert.match(fullSql,/Direct roles mutation bypassed restrictive release grants/);
 assert.match(fullSql,/Non-admin operations account escalated roles/);
 assert.match(fullSql,/Allowlisted self-profile edit failed/);
 assert.match(fullSql,/ROLLBACK;/);
});
test('consolidated migration retains all 35 policies with two compatibility RPCs in one transaction',()=>{
 assert.equal((all.match(/^CREATE POLICY /gm)||[]).length,35);
 assert.match(all,/CREATE OR REPLACE FUNCTION public\.crm_admin_manage_user/);
 assert.match(all,/CREATE OR REPLACE FUNCTION public\.crm_update_own_profile/);
 assert.match(all,/DO \$b49_compat\$/);
 assert.match(all,/COMMIT;/);
});
test('no migration is activated or production tests counted as accepted',()=>{
 assert.match(all,/RELEASE HOLD/);
 assert.match(admin,/NOT AN ACTIVE MIGRATION/);
 assert.match(self,/No production write/);
 assert.match(read('security/build49/README.md'),/0\/140/);
});
