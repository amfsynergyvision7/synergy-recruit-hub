import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt");
const pre=read("../build160-email-reconciliation/audit-integrity.preflight.readonly.sql");
const fixture=read("../build159-email-journal/disposable-pg17-trusted-journal.sql");
const matrix=read("./audit-grant-matrix.readonly.sql");

test("Build163 proposed lockdown revokes all three missed PG17 privileges without enabling changes",()=>{
 assert.match(sql,/REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public\.audit_logs\s+FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM PUBLIC,anon/);
 assert.match(sql,/REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM authenticated/);
 assert.match(sql,/REVOKE UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM service_role/);
 assert.match(sql,/DO NOT APPLY/);
 assert(!sql.includes("COMMIT;"));
});
test("Build163 release preflight rejects effective references, trigger and maintain for every app role",()=>{
 for(const [role,prefix] of [["anon","anon"],["authenticated","auth"],["service_role","service"]]){
  for(const priv of ["REFERENCES","TRIGGER","MAINTAIN"]){
   assert(pre.includes("has_table_privilege('"+role+"','public.audit_logs','"+priv+"')"));
   const field=prefix+"_"+priv.toLowerCase();
   assert(pre.includes(field),field);
   assert(pre.includes("AND NOT "+field),field);
  }
 }
});
test("Build163 admin SELECT policy is matched exactly, not substring heuristic",()=>{
 assert(pre.includes("btrim(coalesce(p.qual,''))='has_role(auth.uid(), ''admin''::app_role)'"));
 assert(!pre.includes("p.qual LIKE '%has_role%'"));
 assert(!pre.includes("p.qual LIKE '%admin%'"));
 assert(pre.includes("total_audit_policies=1"));
});
test("Build163 actual disposable PG17 fixture reproduces all missed privilege grants and revokes them",()=>{
 assert.match(fixture,/GRANT UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN\s+ON public\.audit_logs TO service_role/);
 assert.match(fixture,/GRANT REFERENCES,TRIGGER,MAINTAIN\s+ON public\.audit_logs TO anon,authenticated/);
 for(const role of ["anon","authenticated","service_role"])
  for(const priv of ["REFERENCES","TRIGGER","MAINTAIN"])
   assert(fixture.includes("has_table_privilege('"+role+"','public.audit_logs','"+priv+"')"));
 assert(fixture.includes("\\ir ../build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt"));
 assert.match(fixture,/ROLLBACK;\s*$/);
});
test("Build163 source-pinned grant matrix reports only catalog metadata and role flags",()=>{
 for(const x of ["FROM pg_catalog.pg_class","pg_catalog.aclexplode","pg_catalog.pg_roles",
  "effective_permission_matrix","explicit_acl_grants","exact_admin_reader_matches",
  "rolbypassrls","relforcerowsecurity","REFERENCES","TRIGGER","MAINTAIN"])
   assert(matrix.includes(x),x);
 assert.equal((matrix.match(/;/g)||[]).length,1);
 const q=matrix.replace(/--[^\n]*/g,"").trim();
 assert.match(q,/^WITH\s+r\s+AS/i);
 assert.doesNotMatch(q,/\bFROM\s+(?:public|auth)\./i);
 assert.doesNotMatch(q,/\bSELECT\s+\*\s+FROM\b/i);
});
test("Build163 CI includes source and actual disposable role tests but no hosted writes",()=>{
 const yaml=read("../../.github/workflows/build155-email-audit.yml");
 assert(yaml.includes("security/build163-audit-grants/**"));
 assert(yaml.includes("security/build163-audit-grants/contract.test.mjs"));
 assert(yaml.includes("security/build159-email-journal/disposable-pg17-trusted-journal.sql"));
 assert(!yaml.includes("workflow_dispatch:"));
});
test("Build163 all immutable email and reconciliation release holds remain enabled",()=>{
 for(const file of ["../../src/lib/crm-email-audit-integrity.server.ts",
  "../../src/lib/crm-email-reconciliation-hold.server.ts"]){
  assert.match(read(file),/RELEASE_HOLD = true as const/);
 }
 const src=read("../../src/lib/email.functions.ts");
 assert(src.includes("assertExternalEffectReleased(\"crm_email\")"));
 assert(src.includes("assertCrmEmailAuditIntegrityReleased()"));
 assert(src.includes("assertCrmEmailReconciliationReleased()"));
});
