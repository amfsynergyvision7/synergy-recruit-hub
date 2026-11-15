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
