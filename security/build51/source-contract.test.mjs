import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p,"utf8");
const sql = read("security/build51/candidate-stage-rpc-review-only.sql");
const client = read("src/lib/candidate-stage.ts");
const board = read("src/components/CandidateBoard.tsx");
const safety = read("src/lib/release-safety.ts");
const wf = read(".github/workflows/security-build34-review.yml");

test("stage RPC uses JWT-derived actor and checks active approved role",()=>{
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
  assert.match(sql,/p\.status='approved' AND p\.is_active IS TRUE/);
  assert.match(sql,/r\.role IN \('admin','recruiter'\)/);
  assert.match(sql,/v_assigned IS DISTINCT FROM v_actor/);
  assert.doesNotMatch(sql,/p_actor|p_recruiter_id/);
});
test("stage transition has allowlist, CAS row lock and no finance-trigger targets",()=>{
  assert.match(sql,/p_new_stage NOT IN \(/);
  assert.match(sql,/FROM public\.candidates c WHERE c\.id=p_candidate_id FOR UPDATE/);
  assert.match(sql,/v_old_stage IS DISTINCT FROM p_expected_stage/);
  assert.match(sql,/IF v_old_stage='joined' THEN/);
  assert.doesNotMatch(sql,/p_new_stage::public\.candidate_stage[\s\S]*INSERT INTO public\.billing/);
  for(const stage of ["submitted_to_client","interview_scheduled","offer_released","joined"]) {
    const allowlist = sql.match(/IF p_new_stage NOT IN \(([\s\S]*?)\) THEN/)[1];
    assert.equal(allowlist.includes("'"+stage+"'"),false);
  }
});
test("direct candidate stage UPDATE revoked; RPC authenticated only",()=>{
  assert.match(sql,/REVOKE UPDATE\(stage\) ON public\.candidates FROM authenticated/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.crm_change_candidate_stage\(uuid,text,text\)/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(sql,/TO authenticated/);
  assert.match(sql,/INSERT INTO public\.audit_logs/);
});
test("client calls only the audited RPC and remains held",()=>{
  assert.match(safety,/LEGACY_CANDIDATE_WRITES_PAUSED = true as const/);
  assert.match(client,/if \(LEGACY_CANDIDATE_WRITES_PAUSED\)/);
  assert.match(client,/rpc\.rpc\("crm_change_candidate_stage"/);
  assert.match(board,/changeCandidateStage\(\{ candidateId, expectedStage: candidate\.stage, newStage \}\)/);
  assert.doesNotMatch(board,/\.update\(\{ stage: newStage \}\)/);
  assert.match(wf,/build51-stage-transaction-review:/);
  assert.match(wf,/production-release-hold:/);
});
