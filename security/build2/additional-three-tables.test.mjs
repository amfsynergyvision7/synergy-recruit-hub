import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./additional-three-tables-review-only.sql',import.meta.url),'utf8');
function statement(name) {
 const m=sql.match(new RegExp('CREATE POLICY '+name+' ON public\\.[a-z_]+[\\s\\S]*?;','i'));
 assert.ok(m,'missing '+name);
 return m[0];
}
test('additional SQL is marked review-only and unsafe for production',()=>assert.match(sql,/DO NOT RUN ON PRODUCTION/));
test('transaction is explicit',()=>{assert.match(sql,/\bBEGIN;/);assert.match(sql,/\bCOMMIT;/)});
for(const name of ['app_settings_approved_read','app_settings_approved_admin_update','email_log_scoped_read','email_log_approved_insert','workflow_rules_approved_admin']) {
 test(name+' requires approval',()=>assert.match(statement(name),/is_approved\(auth\.uid\(\)\)/));
}
test('settings read is admin only',()=>assert.match(statement('app_settings_approved_read'),/has_role\(auth\.uid\(\),'admin'\)/));
test('email log read checks sender ownership',()=>assert.match(statement('email_log_scoped_read'),/sent_by=auth\.uid\(\)/));
test('email log recruiter insert checks sender ownership',()=>assert.match(statement('email_log_approved_insert'),/sent_by=auth\.uid\(\)/));
test('workflow rule writes require approved admin',()=>{const p=statement('workflow_rules_approved_admin');assert.match(p,/FOR ALL/);assert.match(p,/WITH CHECK/);assert.match(p,/has_role\(auth\.uid\(\),'admin'\)/)});
test('anonymous grants revoked for all three tables',()=>{for(const t of ['app_settings','email_log','workflow_rules'])assert.match(sql,new RegExp('public\\.'+t));assert.match(sql,/FROM anon;/)});
