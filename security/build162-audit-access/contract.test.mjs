import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const pre=read("../build160-email-reconciliation/audit-integrity.preflight.readonly.sql");
const fix=read("../build159-email-journal/disposable-pg17-trusted-journal.sql");
const lock=read("../build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt");
const inventory=read("./audit-producer-inventory.readonly.sql");

test("Build162 effective anonymous and authenticated TRUNCATE permissions are release blockers",()=>{
 for(const role of ["anon","authenticated"])assert(pre.includes("has_table_privilege('"+role+"','public.audit_logs','TRUNCATE')"));
 for(const x of ["anon_truncate","auth_truncate","AND NOT anon_truncate","AND NOT auth_truncate","total_audit_policies=1"])assert(pre.includes(x));
});
test("Build162 source-identical lockdown remains review-only and denies untrusted table mutations",()=>{
 assert.match(lock,/DO NOT APPLY/);
 assert.match(lock,/REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM PUBLIC,anon/);
 assert.match(lock,/REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM authenticated/);
 assert.match(lock,/REVOKE UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM service_role/);
 assert(fix.includes("\\ir ../build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt"));
});
test("Build162 disposable PG17 switches SQL roles and denies all anon access and authenticated writes",()=>{
 for(const x of ["SET LOCAL ROLE anon;","SET LOCAL ROLE authenticated;",
 "BUILD162 FAIL: anonymous audit ACL allowed","BUILD162 FAIL: authenticated audit mutation allowed",
 "WHEN insufficient_privilege THEN denied:=true","TRUNCATE public.audit_logs","DELETE FROM public.audit_logs",
 "UPDATE public.audit_logs SET action","INSERT INTO public.audit_logs(action)","BUILD162 FAIL: append-only evidence or ACL unsafe"])assert(fix.includes(x),x);
 assert.match(fix,/ROLLBACK;\s*$/);
 assert.match(fix,/current_database\(\) <> 'amf_build158_email_lab'/);
});
test("Build162 synthetic RLS reader checks approved admin and disallows ordinary viewer",()=>{
 for(const x of ['CREATE POLICY "read audit"',"SECURITY DEFINER SET search_path=''",
 "BUILD162 FAIL: non-admin audit reader sees rows","BUILD162 FAIL: approved admin cannot read audit metadata",
 "SET LOCAL request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc'",
 "SET LOCAL request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"])assert(fix.includes(x),x);
 assert(!lock.includes("CREATE POLICY"));
});
test("Build162 audit producers are listed via catalogs without selecting business/audit rows",()=>{
 for(const x of ["FROM pg_catalog.pg_proc","FROM pg_catalog.pg_trigger",
 "FROM pg_catalog.pg_rewrite","JOIN pg_catalog.pg_depend",
 "pg_get_functiondef(p.oid)","REVIEW_EXTERNAL_AUDIT_PRODUCERS_REQUIRED",
 "function_literal_matches","trigger_matches","view_dependencies"])assert(inventory.includes(x),x);
 assert.equal((inventory.match(/;/g)||[]).length,1);
 assert.match(inventory,/^-- Build162 READ ONLY/);
 assert.doesNotMatch(inventory,/\bFROM\s+(?:public|auth)\./i);
 assert(!inventory.includes("SELECT *"));
});
test("Build162 tests run in the existing secret-free PR CI, no hosted operations",()=>{
 const y=read("../../.github/workflows/build155-email-audit.yml");
 assert(y.includes("security/build162-audit-access/**"));
 assert(y.includes("security/build162-audit-access/contract.test.mjs"));
 assert(y.includes("node --test"));
 assert(!y.includes("workflow_dispatch:"));
});
