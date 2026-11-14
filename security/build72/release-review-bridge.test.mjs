import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const risk=JSON.parse(read("security/build72/live-truncate-and-function-acl-snapshot.json"));
const tableDraft=read("security/build40/19-table-privileges-review-only.sql");
const fnDraft=read("security/build40/16-security-definer-acl-review-only.sql");
const viewDraft=read("security/build59/13-view-write-acl-review-only.sql");

test("existing inactive 19-table review SQL covers every live TRUNCATE grant",()=>{
 const line=tableDraft.match(/^REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON (.+) FROM PUBLIC,anon,authenticated;$/m);
 assert.ok(line,"TRUNCATE review must revoke for all three principals");
 const tables=line[1].split(",").map(x=>x.trim().replace(/^public\./,""));
 assert.equal(tables.length,19);
 assert.deepEqual(new Set(tables),new Set(risk.tables.map(t=>t.table_name)));
 assert.ok(tableDraft.includes("Do not apply to production/staging"));
});

test("existing inactive 16-function review SQL revokes PUBLIC AND anon and preserves only 3 auth helpers",()=>{
 const revokes=[...fnDraft.matchAll(/^REVOKE EXECUTE ON FUNCTION public\.([a-z_]+)\([^;]*\) FROM PUBLIC,anon,authenticated;$/gm)]
 .map(m=>m[1]);
 assert.equal(revokes.length,16);
 assert.deepEqual(new Set(revokes),new Set(risk.security_definer_functions.map(x=>x.function_name)));
 assert.equal((fnDraft.match(/^REVOKE EXECUTE ON FUNCTION public\./gm)||[]).length,16);
 assert.ok(fnDraft.includes("GRANT EXECUTE ON FUNCTION public.get_user_role(uuid),public.has_role(uuid,public.app_role),public.is_approved(uuid) TO authenticated;"));
 assert.match(fnDraft,/Function bodies unchanged/);
});

test("inactive 13-view draft retains existing source hash and requires all invoker-safe and no anon read",()=>{
 assert.ok(viewDraft.includes("a90d4a1fab9552d47697127888e10d19"));
 assert.ok(viewDraft.includes("invokers<>13 OR anonreads<>0"));
 assert.match(viewDraft,/not a deployable migration/i);
 assert.match(viewDraft,/production source SQL 13-view digest/i);
});
