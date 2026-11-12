import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=(p)=>readFileSync(p,"utf8");
const crud=text("src/components/CrudModule.tsx");
const board=text("src/components/CandidateBoard.tsx");
const imp=text("src/routes/_app.import.tsx");
const dup=text("src/routes/_app.duplicates.tsx");
const safety=text("src/lib/release-safety.ts");
const candidateWrite=text("src/lib/candidate-write.ts");
const stage=text("src/lib/candidate-stage.ts");
const atomic=text("src/lib/candidate-batch-import.ts");

test("Candidate Board cannot regress to direct stage DML from PR11",()=>{
 assert.match(board,/const editable = canEdit\(role, "candidates"\) && !LEGACY_CANDIDATE_WRITES_PAUSED/);
 assert.match(board,/changeCandidateStage\(\{ candidateId, expectedStage: candidate\.stage, newStage \}\)/);
 assert.doesNotMatch(board,/\.update\(\{ stage: newStage \}\)/);
 assert.match(stage,/rpc\.rpc\("crm_change_candidate_stage"/);
});
test("Candidate CrudModule cannot bypass held RPC on create/update/deletion",()=>{
 assert.match(crud,/candidateMutationPaused = module === "candidates" && LEGACY_CANDIDATE_WRITES_PAUSED/);
 assert.match(crud,/if \(candidateMutationPaused\) \{ toast\.error\(CANDIDATE_MUTATION_HOLD_REASON\); return; \}/);
 assert.match(crud,/saveCandidateRecord\(\{/);
 assert.match(crud,/delete payload\.stage/);
 assert.match(candidateWrite,/rpc\.rpc\("crm_write_candidate"/);
 assert.match(candidateWrite,/if \(LEGACY_CANDIDATE_WRITES_PAUSED\)/);
});
test("Import and duplicate handlers cannot be reopened through client flags",()=>{
 assert.match(safety,/LEGACY_CANDIDATE_WRITES_PAUSED = true as const/);
 assert.match(safety,/LEGACY_BULK_IMPORT_WRITES_PAUSED = true as const/);
 assert.match(imp,/if \(LEGACY_BULK_IMPORT_WRITES_PAUSED\)/);
 assert.match(imp,/disabled=\{running \|\| LEGACY_BULK_IMPORT_WRITES_PAUSED\}/);
 assert.match(atomic,/if \(LEGACY_BULK_IMPORT_WRITES_PAUSED\)/);
 assert.match(atomic,/rpc\.rpc\("crm_import_candidates_atomic"/);
 assert.match(dup,/toast\.error\(CANDIDATE_MUTATION_HOLD_REASON\)/);
 assert.doesNotMatch(dup,/\.from\("candidates"\)\.delete\(/);
});
