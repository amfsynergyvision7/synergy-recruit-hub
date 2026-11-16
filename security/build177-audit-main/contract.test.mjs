import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=dirname(fileURLToPath(import.meta.url));
const reviewed=join(root,"reviewed");
const sha=b=>createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length),Buffer.from([0]),b])).digest("hex");
const files={
  "lockdown.DO-NOT-APPLY.sql.txt": "568298c8556d21adb26afd6a583ecad8d8d4f0f0",
  "audit-integrity.preflight.readonly.sql": "16a656ca76bbda43d9c9d6015b16e4e5d4c04d59",
  "audit-producer-inventory.readonly.sql": "1b3e1c75d8daeb85659b499dc6e8fe48fd28516a",
  "audit-grant-matrix.readonly.sql": "296dd81c4a20b40de929bf5e06f3f53cbb1e2777",
  "reconcile-confirm-sent.DO-NOT-APPLY.sql.txt": "a5c9d51cd34d888bc2b4283270e3adaaff99c382"
};
const read=f=>readFileSync(join(reviewed,f),"utf8");
test("Build177 five reviewed audit sources are byte-identical to original PR18 Git blobs",()=>{
  for(const [name,digest] of Object.entries(files)){
    assert(existsSync(join(reviewed,name)),name);
    assert.equal(sha(readFileSync(join(reviewed,name))),digest,name);
  }
});
test("Build177 unsafe audit-grant proposal is explicitly NON EXECUTABLE production source",()=>{
 const body=read("lockdown.DO-NOT-APPLY.sql.txt");
 assert.match(body,/DO NOT APPLY/);
 assert.match(body,/REVOKE REFERENCES,TRIGGER,MAINTAIN\s+ON TABLE public\.audit_logs/s);
 assert.match(body,/FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(body,/REVOKE UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs/);
 assert.match(body,/DROP POLICY IF EXISTS "Allow all for authenticated"/);
});
test("Build177 trusted reconciliation remains DO-NOT-APPLY and restricted to manual review",()=>{
 const body=read("reconcile-confirm-sent.DO-NOT-APPLY.sql.txt");
 assert.match(body,/DO NOT APPLY/);
 assert.match(body,/crm_email_confirm_sent_trusted/);
 assert.match(body,/SECURITY INVOKER/);
 assert.match(body,/current_user\s*<>\s*'service_role'/);
});
test("Build177 preflight explicitly holds all broad privilege and untrusted RPC risks",()=>{
 const sql=read("audit-integrity.preflight.readonly.sql");
 for(const x of ["anon_truncate","anon_references","anon_trigger","anon_maintain","auth_delete",
 "auth_truncate","service_delete","service_truncate","service_maintain",
 "broadly_permissive_all","safe_rpc_count","admin_select_policies",
 "HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT"])
 assert(sql.includes(x),x);
 assert(!/\b(?:UPDATE|DELETE|INSERT|DROP|CREATE|ALTER|TRUNCATE)\s+(?:TABLE|POLICY|FUNCTION)\b/iu.test(sql));
});
test("Build177 inventory explicitly states external and dynamic writers are not proved absent",()=>{
 const sql=read("audit-producer-inventory.readonly.sql");
 assert.match(sql,/external services, dynamic SQL and other schemas need human review/i);
 assert.match(sql,/REVIEW_EXTERNAL_AUDIT_PRODUCERS_REQUIRED/);
});
test("Build177 isolated workflow is offline and intentionally refuses main merge",()=>{
 const workflow=readFileSync(join(root,"../../.github/workflows/build177-audit-main.yml"),"utf8");
 assert(workflow.includes("postgres:17"));
 assert(workflow.includes("main-release-hold:"));
 assert(workflow.includes("exit 1"));
 assert(workflow.includes("pg17-disposable-rollback.sql"));
 assert(!workflow.includes("workflow_dispatch:"));
 assert(!workflow.includes("SUPABASE_"));
 assert(!workflow.includes("VERCEL_"));
 assert(!workflow.includes("GITHUB_TOKEN:"));
});

test("Build178 reproduces exact source-pinned audit release HOLD on both sides of disposable revoke",()=>{
 const script=readFileSync(join(root,"pg17-disposable-rollback.sql"),"utf8");
 const ci=readFileSync(join(root,"../../.github/workflows/build177-audit-main.yml"),"utf8");
 assert.match(script,/Build178 pre-revocation source-pinned release gate correctly HOLDS/);
 assert.match(script,/Build178 post-revocation source-pinned release gate STILL HOLDS/);
 assert.equal((script.match(/\\i \/tmp\/build178-audit-preflight\.gset\.sql/g)||[]).length,2);
 assert.match(script,/audit_safe_rpc_count::integer = 0/);
 assert.match(script,/audit_admin_select_policies::integer = 1/);
 assert.match(script,/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
 assert.match(ci,/audit-integrity\.preflight\.readonly\.sql/);
 assert.match(ci,/FROM facts;/);
 assert.match(ci,/pg17-disposable-rollback\.sql/);
 assert(!ci.includes("workflow_dispatch:"));
});
test("Build178 read-only role and ACL graph is catalog-only with no data selection",()=>{
 const source=readFileSync(join(root,"role-inheritance.readonly.sql"),"utf8");
 assert.match(source,/Build178 READ ONLY/);
 assert.match(source,/pg_catalog\.pg_auth_members/);
 assert.match(source,/pg_catalog\.aclexplode/);
 assert.match(source,/has_table_privilege/);
 for(const q of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"])
  assert(source.includes("('"+q+"')"),q);
 assert(!/\b(?:FROM|JOIN)\s+public\.audit_logs\b/i.test(source));
 assert(!/\b(?:DROP|REVOKE|GRANT|ALTER|CREATE)\s+(?:TABLE|POLICY|ROLE|FUNCTION|SCHEMA)\b/i.test(source));
});

test("Build179 catalog positive-control uses deliberately inert mock reconciliation, not operational approval",()=>{
 const sql=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.match(sql,/NOOP_NOT_A_REAL_RECONCILIATION/);
 assert.match(sql,/REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE/);
 assert.match(sql,/BUILD179_CATALOG_MATCH_IS_NOT_BEHAVIOR_OR_RELEASE/);
 assert.match(sql,/CREATE FUNCTION public\.crm_email_confirm_sent_trusted\(p_attempt uuid,p_admin uuid,p_case_ref text,p_provider_id text\)/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
 assert.match(sql,/ROLLBACK;/);
 assert(!sql.includes("SUPABASE_SERVICE_ROLE_KEY"));
});
test("Build179–186 thirty independent privilege/policy/function regressions are required to HOLD",()=>{
 const sql=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.equal((sql.match(/^SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((sql.match(/^ROLLBACK TO SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((sql.match(/^RELEASE SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((sql.match(/BUILD179_EXPECTED_HOLD_\d\d/g)||[]).length,14);
 assert.equal((sql.match(/\\i \/tmp\/build179-corrected-preflight\.gset\.sql/g)||[]).length,32);
 assert.match(sql,/GRANT TRUNCATE ON public\.audit_logs TO anon/);
 assert.match(sql,/GRANT UPDATE ON public\.audit_logs TO authenticated/);
 assert.match(sql,/GRANT MAINTAIN ON public\.audit_logs TO authenticated/);
 assert.match(sql,/GRANT TRIGGER ON public\.audit_logs TO service_role/);
 assert.match(sql,/CREATE POLICY "Unrestricted malicious regression"/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/DROP POLICY "read audit" ON public\.audit_logs/);
 assert.match(sql,/BUILD179_RESTORED_CATALOG_MOCK_MATCH/);
 assert.match(sql,/BUILD179_FULL_ROLLBACK_VERIFIED/);
});
test("Build179 disposable CI uses only temporary local database service and retains release HOLD",()=>{
 const ci=readFileSync(join(root,"../../.github/workflows/build177-audit-main.yml"),"utf8");
 assert.match(ci,/pg17-gate-sensitivity\.sql/);
 assert.match(ci,/postgres:17/);
 assert.match(ci,/main-release-hold:/);
 assert.match(ci,/exit 1/);
 assert(!/workflow_dispatch:|SUPABASE_|VERCEL_|DATABASE_URL|service_role_key/i.test(ci));
});

test("Build179 failure controls have a PostgreSQL nonzero error path, never unsupported psql quit arguments",()=>{
 const script=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.equal((script.match(/SELECT 1\/0;/g)||[]).length,33);
 assert(!/\\quit\s+[345]/.test(script));
 assert.match(script,/ON_ERROR_STOP on/);
});

test("Build179 corrected read-only PG17 preflight uses observed empty search_path encoding and exact RPC argument types",()=>{
 const original=read("audit-integrity.preflight.readonly.sql");
 const v2=readFileSync(join(root,"audit-integrity.pg17-corrected.readonly.sql"),"utf8");
 const fixture=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.match(original,/array_position\(proconfig,'search_path='\) IS NOT NULL/);
 assert.match(v2,/array_position\(proconfig,'search_path=""'\) IS NOT NULL/);
 assert.match(v2,/proargtypes\[0\]='uuid'::regtype/);
 assert.match(v2,/proargtypes\[3\]='text'::regtype/);
 assert.match(fixture,/BUILD179_ORIGINAL_PREFLIGHT_FALSE_HOLD_CONFIRMED/);
 assert.match(fixture,/BUILD179_EXPECTED_HOLD_13/);
 assert.match(fixture,/BUILD179_EXPECTED_HOLD_14/);
 assert.match(fixture,/NOOP_INVALID_SIGNATURE/);
 assert(!/\b(?:ALTER|DROP|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|CREATE)\s+(?:TABLE|ROLE|POLICY|FUNCTION)\b/i.test(v2));
});

test("Build180 RLS bypass, restrictive-only policy and app-role ownership are fail-closed catalog gates",()=>{
 const sql=readFileSync(join(root,"audit-integrity.pg17-corrected.readonly.sql"),"utf8");
 const fixture=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.match(sql,/p\.permissive='PERMISSIVE'/);
 assert.match(sql,/rolbypassrls OR rolsuper/);
 assert.match(sql,/independent_table_owner/);
 assert.match(sql,/anon_rls_enforced AND auth_rls_enforced/);
 assert.match(fixture,/ALTER ROLE authenticated BYPASSRLS/);
 assert.match(fixture,/ALTER ROLE anon BYPASSRLS/);
 assert.match(fixture,/AS RESTRICTIVE FOR SELECT TO authenticated/);
 assert.match(fixture,/ALTER TABLE public\.audit_logs OWNER TO authenticated/);
 for(const n of [15,16,17,18])assert(fixture.includes("BUILD180_EXPECTED_HOLD_"+n),n);
 assert.equal((fixture.match(/BUILD180_EXPECTED_HOLD_\d\d/g)||[]).length,4);
 assert.equal((fixture.match(/SELECT 1\/0;/g)||[]).length,33);
 assert(!/\b(?:CREATE|DROP|ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE)\s+(?:TABLE|POLICY|ROLE|FUNCTION)\b/iu.test(sql));
});

test("Build181 ensures audited RPC is a normal set-returning function with correct TABLE output contract",()=>{
 const sql=readFileSync(join(root,"audit-integrity.pg17-corrected.readonly.sql"),"utf8");
 const pg=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 for(const key of ["prokind='f'","proretset","prorettype='record'::regtype",
  "array_length(proallargtypes,1)=6","proallargtypes[5]='uuid'::regtype",
  "proallargtypes[6]='text'::regtype","proargmodes[5]='t'","proargmodes[6]='t'",
  "proargnames[5]='id'","proargnames[6]='status'"]) assert(sql.includes(key),key);
 assert.match(pg,/CREATE PROCEDURE public\.crm_email_confirm_sent_trusted\(uuid,uuid,text,text\)/);
 assert.match(pg,/RETURNS text LANGUAGE sql SECURITY INVOKER/);
 assert.match(pg,/RETURNS TABLE\(id text,status text\)/);
 assert.match(pg,/RETURNS TABLE\(record_id uuid,outcome text\)/);
 for(const n of [19,20,21,22])assert(pg.includes("BUILD181_EXPECTED_HOLD_"+n),n);
 assert.equal((pg.match(/BUILD181_EXPECTED_HOLD_\d\d/g)||[]).length,4);
 assert.equal((pg.match(/SELECT 1\/0;/g)||[]).length,33);
 assert(!/\b(?:ALTER|DROP|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|CREATE)\s+(?:TABLE|ROLE|POLICY|FUNCTION|PROCEDURE)\b/iu.test(sql));
});


test("Build184 guards exact PostgREST input-name contract and four single-name variants",()=>{
 const v2=readFileSync(join(root,"audit-integrity.pg17-corrected.readonly.sql"),"utf8");
 const pg=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 const reviewed=read("reconcile-confirm-sent.DO-NOT-APPLY.sql.txt");
 const names=["p_attempt","p_admin","p_case_ref","p_provider_id"];
 for(let i=0;i<names.length;i++){
  assert(reviewed.includes(names[i]+" "+(i<2?"uuid":"text")),names[i]+" reviewed");
  assert(v2.includes("proargnames["+(i+1)+"]='"+names[i]+"'"),names[i]+" checked");
  assert(pg.includes("BUILD184_EXPECTED_HOLD_"+(23+i)),"negative "+(23+i));
  assert(pg.includes("not_"+names[i]),names[i]+" mutated");
 }
 assert.equal((pg.match(/^SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((pg.match(/^ROLLBACK TO SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((pg.match(/\\i \/tmp\/build179-corrected-preflight\.gset\.sql/g)||[]).length,32);
 assert.equal((pg.match(/SELECT 1\/0;/g)||[]).length,33);
 assert(!/\b(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|CREATE)\s+(?:TABLE|ROLE|POLICY|FUNCTION|PROCEDURE)\b/iu.test(v2));
});


test("Build185 cross-schema audit-writer scan is metadata-only and refuses external-writer clearance",()=>{
 const sql=readFileSync(join(root,"audit-writer-cross-schema.readonly.sql"),"utf8");
 const doc=readFileSync(join(root,"BUILD185-WRITER-INVENTORY.md"),"utf8");
 const executable=sql.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 assert.match(sql,/READ-ONLY METADATA-ONLY WRITER INVENTORY/);
 assert.match(executable,/pg_catalog\.pg_proc/);
 assert.match(executable,/pg_catalog\.pg_trigger/);
 assert.match(executable,/pg_catalog\.pg_depend/);
 assert.match(executable,/pg_catalog\.pg_get_functiondef/);
 assert.match(executable,/n\.nspname NOT IN \('pg_catalog','information_schema'\)/);
 assert.match(executable,/REVIEW_ONLY_NOT_PROOF_OF_ABSENCE_OF_EXTERNAL_OR_DYNAMIC_WRITERS/);
 assert(!/\b(?:FROM|JOIN)\s+public\.audit_logs\b/iu.test(executable));
 assert(!/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE)\b\s+(?:INTO|FROM|TABLE|ROLE|POLICY|FUNCTION|PROCEDURE|SCHEMA)\b/iu.test(executable));
 assert.match(doc,/Production.*Isolated nonproduction/);
 assert.match(doc,/158/);
 assert.match(doc,/142/);
 assert.match(doc,/zero|0/);
 assert.match(doc,/not evidence|NOT evidence/i);
 assert.match(doc,/PITR/);
});


test("Build186 hardens admin policy helper dependency in review-only audit catalog gate",()=>{
 const sql=readFileSync(join(root,"audit-integrity.pg17-corrected.readonly.sql"),"utf8");
 const pg=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 for(const term of ["safe_admin_helper_count","auth_public_schema_usage",
   "to_regprocedure('public.has_role(uuid,public.app_role)')",
   "has_function_privilege('authenticated',p.oid,'EXECUTE')",
   "NOT has_function_privilege('anon',p.oid,'EXECUTE')",
   "array_position(p.proconfig,'search_path=\"\"') IS NOT NULL",
   "p.prosecdef","safe_admin_helper_count=1"])assert(sql.includes(term),term);
 assert.match(pg,/CREATE FUNCTION public\.has_role\(uuid,public\.app_role\) RETURNS boolean\s+LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''/);
 assert.match(pg,/REVOKE ALL ON FUNCTION public\.has_role\(uuid,public\.app_role\) FROM PUBLIC/);
 assert.match(pg,/GRANT EXECUTE ON FUNCTION public\.has_role\(uuid,public\.app_role\) TO authenticated/);
 for(const n of [27,28,29,30])assert(pg.includes("BUILD186_EXPECTED_HOLD_"+n),n);
 assert.equal((pg.match(/^SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((pg.match(/^ROLLBACK TO SAVEPOINT build179_mutation;/gm)||[]).length,30);
 assert.equal((pg.match(/\\i \/tmp\/build179-corrected-preflight\.gset\.sql/g)||[]).length,32);
 assert.equal((pg.match(/SELECT 1\/0;/g)||[]).length,33);
 assert(!/\b(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|CREATE)\s+(?:TABLE|ROLE|POLICY|FUNCTION|PROCEDURE)\b/iu.test(sql));
});


test("Build186 helper impact inventory is source-pinned, catalog-only and never auto-approves",()=>{
 const sql=readFileSync(join(root,"role-helper-impact.readonly.sql"),"utf8");
 const doc=readFileSync(join(root,"BUILD186-HELPER-IMPACT.md"),"utf8");
 const executable=sql.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 for(const fragment of [
  "pg_catalog.pg_policies","pg_catalog.pg_proc",
  "pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')",
  "pg_catalog.to_regprocedure('public.has_role(uuid,public.app_role)')",
  "HOLD_STATIC_HELPER_CALLER_INVENTORY_REQUIRES_OWNER_REVIEW",
  "HOLD_HELPER_ABSENT_DEPENDENT_POLICIES_STILL_NEED_REVIEW"
 ])assert(executable.includes(fragment),fragment);
 for(const term of ["41","38","73","92","No hosted writes","PITR","independent"])
  assert(doc.includes(term),term);
 assert(!/\b(?:FROM|JOIN)\s+(?:public|auth|storage)\.(?:user_roles|audit_logs|profiles|candidates|billing|email_log)\b/i.test(executable));
 assert(!/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY)\s+(?:INTO|FROM|TABLE|ROLE|POLICY|FUNCTION|SCHEMA)\b/iu.test(executable));
 assert(!/\b(?:COMMIT|CALL)\s*[\(;]/i.test(executable));
});
