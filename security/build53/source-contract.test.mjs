import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const sql=read("security/build53/atomic-import-rpc-review-only.sql");
const client=read("src/lib/candidate-batch-import.ts");
const page=read("src/routes/_app.import.tsx");
const safety=read("src/lib/release-safety.ts");
const wf=read(".github/workflows/security-build34-review.yml");
const priorComposer=read("security/build52/compose-67-policy-candidate-write.mjs");

test("Build52 full-policy SQL composer contains only one complete footer",()=>{
 assert.equal((priorComposer.match(/const composed=/g)||[]).length,1);
 assert.equal((priorComposer.match(/const output=/g)||[]).length,1);
 assert.match(priorComposer,/\.replace\(finish,\(\)=>cases\+finish\)/);
});
test("atomic import enforces authenticated admin and approved recruiter",()=>{
 assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
 assert.match(sql,/r\.role='admin'/);
 assert.match(sql,/r\.role='recruiter'/);
 assert.match(sql,/p\.status='approved' AND p\.is_active IS TRUE/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crm_import_candidates_atomic\(uuid,uuid,jsonb\)\s+TO authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.crm_import_candidates_atomic/);
});
test("idempotent ledger is private and bound to full payload",()=>{
 assert.match(sql,/CREATE SCHEMA IF NOT EXISTS crm_private/);
 assert.match(sql,/ALTER TABLE crm_private\.candidate_import_batches ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON crm_private\.candidate_import_batches FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/sha256\(convert_to\(p_rows::text,'UTF8'\)\)/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/v_prior\.assignee_id IS DISTINCT FROM p_assigned_recruiter/);
 assert.match(sql,/'status','replayed'/);
});
test("server rejects all unsafe updates and checks all 50 or fewer identities before inserts",()=>{
 assert.match(sql,/v_count<1 OR v_count>50/);
 assert.match(sql,/LOCK TABLE public\.workflow_rules IN SHARE MODE/);
 assert.match(sql,/LOCK TABLE public\.candidates IN SHARE ROW EXCLUSIVE MODE/);
 assert.match(sql,/Repeated email or mobile inside candidate batch/);
 assert.match(sql,/Existing candidate email\/mobile conflict/);
 const noAllowed=sql.match(/ARRAY\['full_name'([\s\S]*?)\]::text\[\]/)?.[0] || "";
 for(const key of ["stage","status","created_by","id","billing","ats_score","assigned_recruiter"]){
   assert.equal(noAllowed.includes("'"+key+"'"),false);
 }
 assert.match(sql,/v_id:=public\.crm_write_candidate\(/);
 assert.match(sql,/INSERT INTO public\.audit_logs/);
});
test("client and UI remain completely release-held; old direct bulk DML absent",()=>{
 assert.match(safety,/LEGACY_BULK_IMPORT_WRITES_PAUSED = true as const/);
 assert.match(client,/if \(LEGACY_BULK_IMPORT_WRITES_PAUSED\)/);
 assert.match(client,/rpc\.rpc\("crm_import_candidates_atomic"/);
 assert.match(page,/commitCandidateImport\(/);
 assert.match(page,/if \(LEGACY_BULK_IMPORT_WRITES_PAUSED\)/);
 assert.match(page,/disabled=\{running \|\| LEGACY_BULK_IMPORT_WRITES_PAUSED\}/);
 assert.doesNotMatch(page,/\.from\(schema\.table as any\)\.insert\(/);
 assert.match(wf,/build53-candidate-atomic-import-review:/);
 assert.match(wf,/production-release-hold:/);
});
