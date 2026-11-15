import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CRM_EMAIL_AUDIT_INTEGRITY_RELEASE_HOLD,
 assertCrmEmailAuditIntegrityReleased,
 confirmCrmEmailAuditReservation,
 confirmCrmEmailAuditSettlement,
 crmEmailOutcomeStatus,
 crmEmailDeliveryReconciliationError
} from '../../src/lib/crm-email-audit-integrity.server.ts';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const email=read('src/lib/email.functions.ts');
const helper=read('src/lib/crm-email-audit-integrity.server.ts');
const smtp=read('src/lib/email.server.ts');
const send=email.slice(email.indexOf('export const sendCrmEmail'),
 email.indexOf('export const listEmailHistory'));
const actor='11111111-1111-4111-8111-111111111111';
const related='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
const expected={id,actorId:actor,relatedTable:'candidates',relatedId:related};
const reserved={id,related_table:'candidates',related_id:related,
 sent_by:actor,status:'pending'};

test('Build155 separate immutable audit release hold cannot be toggled with environment',()=>{
 assert.equal(CRM_EMAIL_AUDIT_INTEGRITY_RELEASE_HOLD,true);
 assert.throws(()=>assertCrmEmailAuditIntegrityReleased(),/audit integrity is paused/);
 assert.doesNotMatch(helper,/process\.env|import\.meta\.env|localStorage/);
 const outbound=send.indexOf('assertExternalEffectReleased("crm_email")');
 const audit=send.indexOf('assertCrmEmailAuditIntegrityReleased()');
 const memberships=send.indexOf('.from("user_roles")');
 assert(outbound>=0&&audit>outbound&&memberships>audit);
 assert(smtp.indexOf('if (isExternalEffectPaused("crm_email"))')<
  smtp.indexOf('const user = process.env.SMTP_USER'));
});
test('Build155 journal reservation must match id actor record and pending status exactly',()=>{
 assert.doesNotThrow(()=>confirmCrmEmailAuditReservation({
  row:reserved,error:null,expected
 }));
 for(const row of [null,{}, {...reserved,id:related},
  {...reserved,sent_by:related},{...reserved,related_id:actor},
  {...reserved,related_table:'billing'},{...reserved,status:'sent'}]){
  assert.throws(()=>confirmCrmEmailAuditReservation({row,error:null,expected}),
   /delivery blocked/);
 }
 assert.throws(()=>confirmCrmEmailAuditReservation({
  row:reserved,error:new Error('private'),expected
 }),/delivery blocked/);
 assert.throws(()=>confirmCrmEmailAuditReservation({
  row:reserved,error:null,expected:{...expected,actorId:'bad'}
 }),/delivery blocked/);
});
test('Build155 pending journal creation is confirmed BEFORE external SMTP call',()=>{
 const first=send.indexOf('.from("email_log" as any)');
 const reserve=send.indexOf('.insert({',first);
 const readback=send.indexOf('.select("id,related_table,related_id,sent_by,status").single()',reserve);
 const confirm=send.indexOf('confirmCrmEmailAuditReservation({',readback);
 const deliver=send.indexOf('result = await sendEmail({',confirm);
 const finish=send.indexOf('.update({',deliver);
 assert(first>=0&&reserve>first&&readback>reserve&&confirm>readback&&deliver>confirm&&finish>deliver);
 assert(send.includes('status: "pending"'));
 assert(send.includes('sent_by: context.userId'));
 assert(send.includes('const attemptId = randomUUID()'));
 assert(!send.slice(0,deliver).includes('supabaseAdmin'));
});
test('Build155 provider failure/unknown is never automatically reported delivered',()=>{
 for(const x of [null,undefined,{}, {success:false},{success:'true'}, {success:0}])
  assert.equal(crmEmailOutcomeStatus(x),'unknown');
 assert.equal(crmEmailOutcomeStatus({success:true}),'sent');
 assert(send.includes('if (finalStatus !== "sent") throw crmEmailDeliveryReconciliationError()'));
 assert(send.includes('status: finalStatus'));
 assert(send.includes('error: finalStatus === "unknown"'));
 assert(send.includes('} catch {'));
 assert.match(crmEmailDeliveryReconciliationError().message,/do not retry/);
});
test('Build155 journal settlement fails closed for mismatched or unreadable rows',()=>{
 const good={id,status:'sent'};
 assert.doesNotThrow(()=>confirmCrmEmailAuditSettlement({
  row:good,error:null,expected:{id,status:'sent'}
 }));
 for(const row of [null,{}, {...good,id:actor},{...good,status:'unknown'}])
  assert.throws(()=>confirmCrmEmailAuditSettlement({
   row,error:null,expected:{id,status:'sent'}
  }),/manual reconciliation/);
 assert.throws(()=>confirmCrmEmailAuditSettlement({
  row:good,error:new Error('private'),expected:{id,status:'sent'}
 }),/manual reconciliation/);
});
test('Build155 finalization updates only exact pending actor-bound row and confirms result',()=>{
 const update=send.indexOf('.update({');
 const byId=send.indexOf('.eq("id", attemptId)',update);
 const byActor=send.indexOf('.eq("sent_by", context.userId)',byId);
 const pending=send.indexOf('.eq("status", "pending")',byActor);
 const confirmed=send.indexOf('confirmCrmEmailAuditSettlement({',pending);
 const success=send.indexOf('return { success: true };',confirmed);
 assert(update>=0&&byId>update&&byActor>byId&&pending>byActor&&confirmed>pending&&success>confirmed);
 assert(send.includes('console.error("[email_log] insert failed; review restricted server diagnostics")'));
 assert(send.includes('console.error("[email_log] update failed; review restricted server diagnostics")'));
 assert(!send.includes('logError.message'));
 assert(!send.includes('settlementError.message'));
});
test('Build155 no-secret policy preflight is a single metadata-only SELECT',()=>{
 const sql=read('security/build155-email-audit/email-log-preflight.readonly.sql');
 assert.match(sql,/^-- Build155 READ-ONLY/);
 assert.match(sql,/FROM pg_catalog\.pg_policies/);
 assert.match(sql,/FROM information_schema\.columns/);
 assert.match(sql,/HOLD_EMAIL_AUDIT_PROTOCOL_NOT_READY/);
 assert.equal((sql.match(/;/g)||[]).length,1);
 assert.doesNotMatch(sql,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(sql,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
});
test('Build155 review documentation preserves independent SQL approval and unknown-outcome caveat',()=>{
 const doc=read('security/build155-email-audit/README.md');
 assert.match(doc,/DO NOT MERGE/i);
 assert.match(doc,/NO authenticated UPDATE policy/i);
 assert.match(doc,/idempotency/i);
 assert.match(doc,/0\/140/);
 assert.match(doc,/manual reconciliation/i);
 assert.match(doc,/issue #17/i);
});
