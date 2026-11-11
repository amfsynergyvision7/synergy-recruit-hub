import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(f)=>readFileSync(f,"utf8");
const sql=read("security/build52/candidate-write-rpc-review-only.sql");
const client=read("src/lib/candidate-write.ts");
const crud=read("src/components/CrudModule.tsx");
const safety=read("src/lib/release-safety.ts");
const workflow=read(".github/workflows/security-build34-review.yml");

test("SQL definer authenticates active approved role, enforces ownership and audited transaction",()=>{
 assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
 assert.match(sql,/p\.status='approved' AND p\.is_active IS TRUE/);
 assert.match(sql,/v_old_assignee IS DISTINCT FROM v_actor/);
 assert.match(sql,/FROM public\.candidates c WHERE c\.id=p_candidate_id FOR UPDATE/);
 assert.match(sql,/v_old_updated IS DISTINCT FROM p_expected_updated_at/);
 assert.match(sql,/INSERT INTO public\.audit_logs/);
 assert.match(sql,/jsonb_build_object\('changed_fields',v_audit_fields\)/);
 assert.doesNotMatch(sql,/p_actor uuid|p_role text/);
});
test("Dangerous candidate fields are never client writable",()=>{
 assert.match(sql,/IF v_key NOT IN \(/);
 const allow=sql.match(/IF v_key NOT IN \(([\s\S]*?)\) THEN/)[1];
 for(const blocked of ["stage","status","created_by","candidate_code","ats_score","ats_issues","resume_summary","id","created_at","billing"]){
  assert.equal(allow.includes("'"+blocked+"'"),false);
 }
 assert.match(sql,/REVOKE INSERT, UPDATE, DELETE ON public\.candidates FROM PUBLIC,anon,authenticated/);
 assert.ok(sql.includes("REVOKE INSERT(%I),UPDATE(%I) ON public.candidates"));
 assert.ok(sql.includes("has_column_privilege('authenticated','public.candidates',v_col,'UPDATE')"));
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crm_write_candidate\(uuid,timestamptz,jsonb\)\s+TO authenticated/);
});
test("Candidate UI now targets the RPC without reopening the Build50 release hold",()=>{
 assert.match(safety,/LEGACY_CANDIDATE_WRITES_PAUSED = true as const/);
 assert.match(client,/if \(LEGACY_CANDIDATE_WRITES_PAUSED\)/);
 assert.match(client,/rpc\.rpc\("crm_write_candidate"/);
 assert.match(crud,/if \(module === "candidates"\) \{/);
 assert.match(crud,/delete payload\.stage/);
 assert.match(crud,/expectedUpdatedAt: editing\?\.updated_at \?\? null/);
 assert.match(crud,/saveCandidateRecord\(\{/);
 assert.match(crud,/module === "candidates" && role !== "admin"/);
 assert.match(workflow,/build52-candidate-write-review:/);
 assert.match(workflow,/production-release-hold:/);
});
