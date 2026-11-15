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
 assert.match(sql,/CREATE FUNCTION public\.crm_email_confirm_sent_trusted\(uuid,uuid,text,text\)/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
 assert.match(sql,/ROLLBACK;/);
 assert(!sql.includes("SUPABASE_SERVICE_ROLE_KEY"));
});
test("Build179 twelve independent privilege/policy/function regressions are required to HOLD",()=>{
 const sql=readFileSync(join(root,"pg17-gate-sensitivity.sql"),"utf8");
 assert.equal((sql.match(/^SAVEPOINT build179_mutation;/gm)||[]).length,12);
 assert.equal((sql.match(/^ROLLBACK TO SAVEPOINT build179_mutation;/gm)||[]).length,12);
 assert.equal((sql.match(/^RELEASE SAVEPOINT build179_mutation;/gm)||[]).length,12);
 assert.equal((sql.match(/BUILD179_EXPECTED_HOLD_\d\d/g)||[]).length,12);
 assert.equal((sql.match(/\\i \/tmp\/build178-audit-preflight\.gset\.sql/g)||[]).length,14);
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
 assert.equal((script.match(/SELECT 1\/0;/g)||[]).length,3);
 assert(!/\\quit\s+[345]/.test(script));
 assert.match(script,/ON_ERROR_STOP on/);
});
