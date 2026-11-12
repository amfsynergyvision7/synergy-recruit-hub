import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("disposable recovery runner refuses nonlocal/non-GitHub execution",()=>{
 const sh=read("security/build60/recovery-disposable-ci.sh");
 for(const token of ['GITHUB_ACTIONS:-','B60_DISPOSABLE_ONLY:-','PGHOST:-','PGPORT:-','PGUSER:-','PGDATABASE:-'])
   assert.ok(sh.includes(token),token);
 assert.match(sh,/exit 84/);
 assert.match(sh,/pg_dump -Fc/);
 assert.match(sh,/pg_restore -e/);
 assert.doesNotMatch(sh,/--no-acl|--no-owner/);
 assert.match(sh,/trap cleanup EXIT/);
});
test("synthetic restore verifies RLS, view semantics, finance hold and row digest",()=>{
 const sql=read("security/build60/synthetic-recovery-source.sql");
 const verify=read("security/build60/synthetic-recovery-verify.sql");
 const digest=read("security/build60/synthetic-recovery-digest.sql");
 assert.match(sql,/CREATE POLICY candidate_own_read/);
 assert.match(sql,/security_invoker=true/);
 assert.match(sql,/zz_b60_invoice_row_hold/);
 assert.match(sql,/zz_b60_invoice_truncate_hold/);
 assert.match(verify,/DO \$b60_recovered\$/);
 assert.match(verify,/SET ROLE authenticated/);
 assert.match(verify,/SET ROLE anon/);
 assert.match(verify,/Recovery owner bypassed invoice trigger/);
 assert.match(digest,/logical_snapshot_digest/);
 assert.doesNotMatch(sql,/example\.com|@|SYNTHETIC-ONLY-PRIVATE/);
});
