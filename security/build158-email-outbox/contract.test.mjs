import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=name=>readFileSync(new URL(name,import.meta.url),"utf8");
const proposed=file("./pending-uniqueness.DO-NOT-APPLY.sql.txt");
const rehearsal=file("./disposable-pg17-rehearsal.sql");
const preflight=file("./pending-index.preflight.readonly.sql");
const workflow=file("../.github/workflows/build155-email-audit.yml".replace("../.github","../../.github"));
const server=readFileSync(new URL("../../src/lib/email.functions.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../../src/components/EmailComposeDialog.tsx",import.meta.url),"utf8");
const integrity=readFileSync(new URL("../../src/lib/crm-email-audit-integrity.server.ts",import.meta.url),"utf8");

test("Build158 reviewed SQL is outside migrations and exclusively pending/unknown uniqueness",()=>{
 assert.match(proposed,/REVIEW-ONLY \/ DO NOT APPLY/);
 assert.match(proposed,/CREATE UNIQUE INDEX email_log_one_unresolved_per_recipient_idx/);
 assert.match(proposed,/ON public\.email_log/);
 assert.match(proposed,/lower\(btrim\(to_email\)\)/);
 assert.match(proposed,/WHERE status IN \('pending', 'unknown'\)/);
 assert.doesNotMatch(proposed,/ON CONFLICT|GRANT|REVOKE|DROP TABLE|ALTER TABLE/i);
 assert.equal((proposed.match(/;/g)||[]).length,1);
});
test("Build158 SQL rehearsal is guarded by disposable db identity and reuses same review SQL",()=>{
 assert.match(rehearsal,/current_database\(\) <> 'amf_build158_email_lab'/);
 assert.match(rehearsal,/^BEGIN;/m);
 assert.match(rehearsal,/^\\ir pending-uniqueness\.DO-NOT-APPLY\.sql\.txt/m);
 assert.match(rehearsal,/\bunique_violation\b/);
 assert.match(rehearsal,/status='unknown'/);
 assert.match(rehearsal,/\bstatus='sent'/);
 assert.match(rehearsal,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(rehearsal,/(^|\n)COMMIT;\s*(\n|$)/);
});
test("Build158 read-only metadata query cannot write or inspect business rows",()=>{
 assert.match(preflight,/^-- Build158 READ-ONLY/);
 assert.match(preflight,/FROM pg_catalog\.pg_index/);
 assert.match(preflight,/HOLD_UNRESOLVED_EMAIL_DUPLICATE_INDEX_ABSENT_OR_DRIFTED/);
 assert.equal((preflight.match(/;/g)||[]).length,1);
 assert.doesNotMatch(preflight,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE|TRUNCATE|DO|EXECUTE|CALL)\b/im);
 assert.doesNotMatch(preflight,/\bFROM public\.email_log\b/i);
});
test("Build158 CI uses only throwaway PG17 lab, never production credentials",()=>{
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/POSTGRES_DB: amf_build158_email_lab/);
 assert.match(workflow,/pg17-partial-unique-rehearsal/);
 assert.match(workflow,/psql -X -v ON_ERROR_STOP=1 -f security\/build158-email-outbox\/disposable-pg17-rehearsal\.sql/);
 assert(!workflow.includes("SUPABASE_SERVICE_ROLE_KEY"));
 assert(!workflow.includes("SUPABASE_DB_PASSWORD"));
});
test("Build158 browser and handler still insist on the primary key and both immutable outbound holds",()=>{
 assert(ui.includes("const requestIdRef = useRef<string | null>(null)"));
 assert(ui.includes("requestIdRef.current = crypto.randomUUID()"));
 assert(server.includes("const attemptId = data.requestId;"));
 assert(server.includes('assertExternalEffectReleased("crm_email")'));
 assert(server.includes("assertCrmEmailAuditIntegrityReleased()"));
 assert(integrity.includes("CRM_EMAIL_AUDIT_INTEGRITY_RELEASE_HOLD = true as const"));
 assert(!server.includes(".upsert("));
});
test("Build158 explicit release caveats disallow claims of universal dedupe",()=>{
 const doc=file("./README.md");
 for(const term of ["DO NOT APPLY","NOT deployed","0/140","0/48","same-recipient","different request IDs","manual reconciliation","PITR"]){
  assert(doc.includes(term),term);
 }
});
