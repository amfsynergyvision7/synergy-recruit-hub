import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=get("./trusted-journal-rpcs.DO-NOT-APPLY.sql.txt");
const lab=get("./disposable-pg17-trusted-journal.sql");
const wf=get("../../.github/workflows/build155-email-audit.yml");
test("Build159 trusted journal review SQL is not a production migration",()=>{
 assert.match(sql,/BUILD159 REVIEW ONLY \/ DO NOT APPLY/);
 assert.equal((sql.match(/^CREATE FUNCTION public\.crm_email_/gm)||[]).length,2);
 assert.match(sql,/SECURITY INVOKER SET search_path = ''/);
 assert.doesNotMatch(sql,/SECURITY DEFINER/);
 assert.match(sql,/current_user <> 'service_role'/);
 assert.match(sql,/CREATE FUNCTION public\.crm_email_reserve_trusted/);
 assert.match(sql,/CREATE FUNCTION public\.crm_email_settle_trusted/);
});
test("Build159 critical role, record, actor and status constraints remain in DB review code",()=>{
 for(const term of ["public.profiles","public.user_roles","public.candidates","public.clients",
 "v_profile_status <> 'approved'","v_active IS NOT TRUE","v_count <> 1",
 "v_role NOT IN ('admin','recruiter')","v_assigned IS DISTINCT FROM p_actor",
 "v_role <> 'admin'","lower(btrim(p_recipient))","journal.sent_by=p_actor",
 "journal.status='pending'","p_status NOT IN ('sent','unknown')"]){
  assert(sql.includes(term),term);
 }
 assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/ON CONFLICT|DO NOTHING|ON CONFLICT DO UPDATE/i);
});
test("Build159 functions revoke implicit default PUBLIC execution and grant service only",()=>{
 assert.equal((sql.match(/REVOKE ALL ON FUNCTION/g)||[]).length,2);
 assert.equal((sql.match(/GRANT EXECUTE ON FUNCTION/g)||[]).length,2);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated\b/);
});
test("Build159 synthetic rehearsal refuses any non-disposable database and rolls back",()=>{
 assert.match(lab,/current_database\(\) <> 'amf_build158_email_lab'/);
 assert.match(lab,/^\\ir trusted-journal-rpcs\.DO-NOT-APPLY\.sql\.txt/m);
 assert.match(lab,/^BEGIN;/m);
 assert.match(lab,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(lab,/^COMMIT;/m);
 assert.match(lab,/insufficient_privilege/);
 assert.match(lab,/has_function_privilege/);
 assert.match(lab,/unique_violation/);
});
test("Build159 CI exercises the exact proposed SQL without Supabase secrets",()=>{
 assert.match(wf,/image: postgres:17/);
 assert.match(wf,/disposable-pg17-trusted-journal\.sql/);
 assert(!wf.includes("SUPABASE_SERVICE_ROLE_KEY"));
 assert(!wf.includes("SUPABASE_DB_PASSWORD"));
});

test("Build159 actual email handler delegates reserve and settle to protected RPCs",()=>{
 const source=get("../../src/lib/email.functions.ts");
 const begin=source.indexOf('export const sendCrmEmail');
 const end=source.indexOf('export const listEmailHistory',begin);
 const send=source.slice(begin,end);
 const hold=send.indexOf('assertCrmEmailAuditIntegrityReleased()');
 const role=send.indexOf('await assertApprovedRole(context.userId');
 const bound=send.indexOf('isCrmEmailRecipientBound({');
 const reserve=send.indexOf('"crm_email_reserve_trusted"');
 const deliver=send.indexOf('deliver: () => sendEmail({');
 const settle=send.indexOf('"crm_email_settle_trusted"');
 assert(hold>=0&&role>hold&&bound>role&&reserve>bound&&deliver>reserve&&settle>deliver);
 assert(send.includes('p_actor: context.userId'));
 assert(send.includes('p_attempt: attemptId'));
 assert(!send.includes('service_role_key'));
 assert(!send.includes('process.env.SUPABASE_SERVICE_ROLE_KEY'));
 assert(!send.includes('onConflict'));
});
