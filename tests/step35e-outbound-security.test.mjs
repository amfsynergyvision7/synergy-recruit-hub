import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const access=read('src/lib/security/record-access.ts');
const ai=read('src/lib/ai.functions.ts');
const email=read('src/lib/email.functions.ts');
test('SEC-12 record access checks approval, role and RLS-visible record',()=>{
  assert.match(access,/profile\.status !== "approved"/);
  assert.match(access,/profile\.is_active !== true/);
  assert.match(access,/\.from\("user_roles"\)/);
  assert.match(access,/\.from\(table\)\.select\("id"\)/);
});
test('SEC-12 all AI operations require explicit external processing approval',()=>{
  assert.equal((ai.match(/assertExternalAiApproved\(process\.env\.CRM_EXTERNAL_AI_APPROVED\)/g)||[]).length,5);
  assert.match(ai,/bulk Drive import is disabled/);
});
test('SEC-11 email sending has unconditional server-side deny',()=>{
  assert.match(email,/recipient must match the authorized CRM record/);
  assert.match(email,/CRM email sending is disabled pending durable outbox verification/);
});

test('SEC-12 all five AI endpoints hard-deny before CRM reads even with approval flag',()=>{
 assert.equal((ai.match(/throw new Error\('SEC-12: AI CRM operations remain disabled/g)||[]).length,5);
 const blocks=ai.split(/\.handler\(async \(\{ context, data \}\) => \{/).slice(1,6);
 assert.equal(blocks.length,5);
 for(const block of blocks){
  assert.ok(block.indexOf('AI CRM operations remain disabled') >= 0);
  assert.ok(block.indexOf('AI CRM operations remain disabled') < block.indexOf('requireCrmRecordAccess('));
 }
});

test('SEC-11 email endpoint denies before recipient or CRM record lookup',()=>{
 const endpoint=email.split('export const sendCrmEmail =')[1].split('export const listEmailHistory =')[0];
 const denial=endpoint.indexOf("throw new Error('SEC-11: CRM email sending is disabled");
 const lookup=endpoint.indexOf('await requireCrmRecordAccess(');
 assert.ok(denial >= 0 && lookup >= 0 && denial < lookup);
});
