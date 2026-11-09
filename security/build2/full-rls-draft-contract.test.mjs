// Offline review-contract tests only: NOT PostgreSQL execution or RLS verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./full-rls-replacement-review-only.sql',import.meta.url),'utf8');
const tables=['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles'];
test('draft explicitly blocks production use',()=>assert.match(sql,/DO NOT RUN ON PRODUCTION/));
test('draft remains transaction wrapped',()=>{assert.match(sql,/\bBEGIN;/);assert.match(sql,/\bCOMMIT;/)});
test('all 15 private tables included in policy cleanup',()=>{for(const table of tables)assert.match(sql,new RegExp("'"+table+"'"))});
test('all 15 private tables included in anonymous grant revocation',()=>{for(const table of tables)assert.match(sql,new RegExp("public\\."+table+"\\b"))});
test('no universal allow-all policy is recreated',()=>assert.doesNotMatch(sql,/CREATE POLICY[^;]*USING\s*\(?true\)?/i));
test('profile and role table writes require privileged workflow',()=>{assert.match(sql,/REVOKE INSERT,UPDATE,DELETE ON public\.profiles FROM authenticated/);assert.match(sql,/REVOKE INSERT,UPDATE,DELETE ON public\.user_roles FROM authenticated/)});
test('recruiter candidate policies check assignee',()=>{for(const name of ['candidates_read','candidates_insert','candidates_update'])assert.match(sql,new RegExp('CREATE POLICY '+name+'[\\s\\S]*?assigned_recruiter=auth\\.uid\\(\\)'))});
test('recruiter jobs policies check assignee',()=>{for(const name of ['jobs_read','jobs_insert','jobs_update'])assert.match(sql,new RegExp('CREATE POLICY '+name+'[\\s\\S]*?assigned_recruiter=auth\\.uid\\(\\)'))});
test('finance and billing do not use unrestricted approved read',()=>assert.match(sql,/CREATE POLICY billing_admin_read[\s\S]*?has_role\(auth.uid\(\),'finance'\)/));
test('all role-dependent policies call approved check',()=>{for(const name of ['candidates_read','jobs_read','submissions_read','interviews_read','offers_read','billing_admin_read'])assert.match(sql,new RegExp('CREATE POLICY '+name+'[\\s\\S]*?is_approved\\(auth\\.uid\\(\\)\\)'))});
test('notification recipient update checks both old and new rows',()=>assert.match(sql,/CREATE POLICY notifications_update[\s\S]*?USING[\s\S]*?WITH CHECK/));
test('column-level privilege blockers explicitly documented',()=>assert.match(sql,/Column privileges and audited server-side workflows are prerequisites/));
