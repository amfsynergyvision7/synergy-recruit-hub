// Offline SQL draft contract checks. NOT a database execution or permission test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./full-rls-replacement-review-only.sql',import.meta.url),'utf8');
const tables=['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles'];
function policy(name) {
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=sql.match(new RegExp('CREATE\\s+POLICY\\s+'+escaped+'\\s+ON\\s+public\\.[a-z_]+[\\s\\S]*?;','i'));
  assert.ok(match,'Missing policy '+name);
  return match[0];
}
test('draft warns against production execution',()=>assert.match(sql,/DO NOT RUN ON PRODUCTION/));
test('transaction has explicit begin and commit',()=>{assert.match(sql,/\bBEGIN;/);assert.match(sql,/\bCOMMIT;/)});
test('all 15 tables appear in policy cleanup inventory',()=>{for(const t of tables)assert.ok(sql.includes("'"+t+"'"),t)});
test('all 15 tables appear in anonymous privilege revocation',()=>{const revoke=sql.match(/REVOKE ALL ON[\s\S]*?FROM anon;/i)?.[0]||'';for(const t of tables)assert.ok(revoke.includes('public.'+t),t)});
test('no created policy has unconditional USING true',()=>{for(const m of sql.matchAll(/CREATE POLICY[\s\S]*?;/gi))assert.doesNotMatch(m[0],/USING\s*\(\s*true\s*\)/i)});
test('privileged profile and role writes are explicitly revoked',()=>{for(const t of ['profiles','user_roles'])assert.match(sql,new RegExp('REVOKE INSERT,UPDATE,DELETE ON public\\.'+t+' FROM authenticated'))});
for(const name of ['candidates_read','candidates_insert','candidates_update','jobs_read','jobs_insert','jobs_update']) {
  test(name+' enforces recruiter assignment',()=>assert.match(policy(name),/assigned_recruiter=auth\.uid\(\)/));
}
for(const name of ['candidates_read','jobs_read','submissions_read','interviews_read','offers_read','billing_admin_read']) {
  test(name+' enforces approved status',()=>assert.match(policy(name),/is_approved\(auth\.uid\(\)\)/));
}
test('billing finance read is explicit',()=>assert.match(policy('billing_admin_read'),/has_role\(auth\.uid\(\),'finance'\)/));
test('notifications update checks old and new recipient',()=>{const p=policy('notifications_update');assert.match(p,/USING\s*\([\s\S]*?user_id=auth\.uid\(\)/);assert.match(p,/WITH CHECK\s*\([\s\S]*?user_id=auth\.uid\(\)/)});
test('column privilege blockers are explicit',()=>assert.match(sql,/Column privileges and audited server-side workflows are prerequisites/));
test('draft denies recruiter submission writes pending compatibility fixes',()=>assert.doesNotMatch(policy('submissions_write'),/recruiter/));
test('draft denies recruiter interview writes pending compatibility fixes',()=>assert.doesNotMatch(policy('interviews_write'),/recruiter/));
