import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {relative,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const src=join(root,"src");
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 const p=join(dir,entry.name);
 if(entry.isDirectory())return walk(p);
 return entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)?[p]:[];
});
const files=walk(src).map(p=>({path:relative(root,p).replaceAll("\\\\","/"),
  content:readFileSync(p,"utf8")}));
const direct=files.flatMap(f=>{
 const matches=[...f.content.matchAll(/\.from\(\s*["'\`]audit_logs["'\`]\s*\)/g)];
 return matches.map(m=>({path:f.path,following:f.content.slice(m.index+m[0].length,m.index+m[0].length+300)}));
});
test("Build161 scan every application source file for direct audit table access",()=>{
 assert(files.length>=150,"unexpectedly incomplete src scan");
 const paths=direct.map(x=>x.path).sort();
 assert.deepEqual(paths,["src/routes/_app.audit.tsx"]);
 for(const hit of direct){
  assert.match(hit.following,/^\s*\.select\(/,"direct audit table access must remain read-only");
  assert.doesNotMatch(hit.following,/^\s*\.(?:insert|update|delete|upsert)\(/);
 }
 console.log("Build161 source inventory:",files.length,"code files;",
  direct.length,"direct audit_logs use; only approved read-only page");
});
test("Build161 no application direct writes or dynamic audit-table bypass literals",()=>{
 const references=files.filter(f=>f.content.includes("audit_logs")).map(f=>f.path).sort();
 const allowed=["src/integrations/supabase/types.ts","src/routes/_app.audit.tsx"];
 const unexpected=references.filter(x=>!allowed.includes(x));
 assert.deepEqual(unexpected,[],"unreviewed new literal audit-table producer");
 assert(files.some(f=>f.path==="src/lib/email.functions.ts"&&
  f.content.includes('"crm_email_confirm_sent_trusted"')),
  "reconciliation audit must be an atomic server RPC");
});
test("Build161 approved audit viewer never opens broad write or raw-details projection",()=>{
 const viewer=files.find(f=>f.path==="src/routes/_app.audit.tsx").content;
 assert.match(viewer,/canReadAuditLogs/);
 assert.match(viewer,/\.select\("id, created_at, user_id, action, table_name, record_id"/);
 assert(!viewer.includes('audit_logs").insert'));
 assert(!viewer.includes("details,"));
});
test("Build161 proposed audit lockdown is append-only even for service_role",()=>{
 const s=readFileSync(join(root,"security/build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt"),"utf8");
 assert.match(s,/FROM PUBLIC,anon/);
 assert.match(s,/FROM authenticated/);
 assert.match(s,/REVOKE UPDATE,DELETE,TRUNCATE ON TABLE public\.audit_logs\s+FROM service_role/);
 assert.doesNotMatch(s,/GRANT\s+(?:UPDATE|DELETE|TRUNCATE)\b/);
 const q=readFileSync(join(root,"security/build160-email-reconciliation/audit-integrity.preflight.readonly.sql"),"utf8");
 for(const field of ["anon_select","auth_select","service_update","service_delete",
  "service_truncate","admin_select_policies","rls_enabled"]){
  assert(q.includes(field),field);
 }
});
test("Build161 real PostgreSQL rehearsal tests effective service-role append-only access",()=>{
 const fixture=readFileSync(join(root,"security/build159-email-journal/disposable-pg17-trusted-journal.sql"),"utf8");
 assert.match(fixture,/GRANT UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN\\s+ON public\\.audit_logs TO service_role/);
 assert(fixture.includes("BUILD161 FAIL: service role can mutate audit history"));
 assert(fixture.includes("BUILD161 FAIL: append-only event was lost"));
 assert(fixture.includes("BUILD160 FAIL: audit failure did not rollback journal"));
});
