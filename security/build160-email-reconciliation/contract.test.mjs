import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("./reconcile-confirm-sent.DO-NOT-APPLY.sql.txt");
const lab=read("../build159-email-journal/disposable-pg17-trusted-journal.sql");
const route=read("../../src/lib/email.functions.ts");
const hold=read("../../src/lib/crm-email-reconciliation-hold.server.ts");

test("Build160 source-only manual reconciliation is service-only and never SMTP",()=>{
 assert.match(sql,/BUILD160 REVIEW ONLY \/ DO NOT APPLY/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|sendEmail|http_post/);
 assert.match(sql,/current_user <> 'service_role'/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
});
test("Build160 only independent approved admin may confirm uncertain message",()=>{
 for(const word of ["v_state<>'approved'","v_active IS NOT TRUE",
 "v_count<>1","v_role<>'admin'","v_sender=p_admin",
 "v_old_status NOT IN ('pending','unknown')","p_case_ref !~",
 "p_provider_id !~","FOR UPDATE","journal.status=v_old_status"]){
  assert(sql.includes(word),word);
 }
});
test("Build160 audit and email status share one atomic DB function",()=>{
 assert.match(sql,/UPDATE public\.email_log/);
 assert.match(sql,/INSERT INTO public\.audit_logs/);
 assert.match(sql,/crm_email_confirmed_sent/);
 assert.match(sql,/pg_catalog\.jsonb_build_object/);
 assert.match(sql,/'case_reference',p_case_ref/);
 assert.match(sql,/'previous_status',v_old_status/);
 assert.doesNotMatch(sql,/DELETE FROM public\.audit_logs/);
});
test("Build160 manual reconciliation web endpoint has a separate immutable release hold",()=>{
 assert.match(hold,/CRM_EMAIL_RECONCILIATION_RELEASE_HOLD = true as const/);
 assert.doesNotMatch(hold,/process\.env/);
 const idx=route.indexOf("export const confirmCrmEmailSent");
 assert(idx>0);
 const handler=route.slice(idx);
 const gate=handler.indexOf("assertCrmEmailReconciliationReleased()");
 const role=handler.indexOf('await assertApprovedRole(context.userId, ["admin"])');
 const rpc=handler.indexOf('"crm_email_confirm_sent_trusted"');
 assert(gate>=0&&role>gate&&rpc>role);
 assert(handler.includes("p_admin: context.userId"));
 assert(!handler.includes("data.adminId"));
 assert(!handler.includes("sendEmail("));
 assert(!handler.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"));
});
test("Build160 PG17 fixture tests rollback of journal state when audit write fails",()=>{
 assert.match(lab,/current_database\(\) <> 'amf_build158_email_lab'/);
 assert.match(lab,/^\\ir ..\/build160-email-reconciliation\/reconcile-confirm-sent\.DO-NOT-APPLY\.sql\.txt/m);
 assert.match(lab,/BUILD160 FAIL: sender reconciled own message/);
 assert.match(lab,/BUILD160 FAIL: audit failure did not rollback journal/);
 assert.match(lab,/BUILD160 FAIL: replay added duplicate audit/);
 assert.match(lab,/^ROLLBACK;$/m);
});


test("Build160 audit ACL lockdown proposal is review-only and removes broad policies",()=>{
 const s=read("./audit-log-lockdown.DO-NOT-APPLY.sql.txt");
 assert.match(s,/BUILD160 REVIEW ONLY \/ DO NOT APPLY/);
 assert.match(s,/REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE/);
 assert.match(s,/REVOKE UPDATE,DELETE,TRUNCATE/);
 assert.match(s,/FROM service_role/);
 assert.match(s,/FROM PUBLIC,anon,authenticated/);
 assert.match(s,/DROP POLICY IF EXISTS "Allow all for authenticated"/);
 assert.match(s,/DROP POLICY IF EXISTS "insert audit"/);
});
test("Build160 disposable database simulates broad audit permission then locks it down",()=>{
 assert.match(lab,/CREATE POLICY "Allow all for authenticated"/);
 assert.match(lab,/GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON public\.audit_logs TO anon,authenticated/);
 assert.match(lab,/^\\ir ..\/build160-email-reconciliation\/audit-log-lockdown\.DO-NOT-APPLY\.sql\.txt/m);
 assert.match(lab,/BUILD160 FAIL: audit lockdown not enforced/);
 assert.match(lab,/BUILD160 FAIL: audit failure did not rollback journal/);
});
test("Build160 production audit integrity preflight is read-only and fail closed",()=>{
 const x=read("./audit-integrity.preflight.readonly.sql");
 assert.match(x,/^-- BUILD160 READ-ONLY/);
 assert.match(x,/FROM pg_catalog\.pg_proc/);
 assert.match(x,/FROM pg_catalog\.pg_policies/);
 assert.match(x,/has_table_privilege\('anon'/);
 assert.match(x,/HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT/);
 assert.equal((x.replace(/--[^\n]*/g,"").match(/;/g)||[]).length,1);
 assert.doesNotMatch(x.replace(/--[^\n]*/g,""),/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|CREATE|DROP|GRANT|REVOKE|ALTER|TRUNCATE|DO)\b/im);
 assert.doesNotMatch(x,/\bFROM public\.audit_logs\b/i);
});
