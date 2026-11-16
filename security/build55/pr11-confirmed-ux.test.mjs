import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync("src/components/CrudModule.tsx","utf8");
const board=readFileSync("src/components/CandidateBoard.tsx","utf8");
test("noncandidate writes require confirmed affected row IDs",()=>{
 assert.match(s,/\.update\(payload\)\.eq\("id", editing\.id\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(s,/\.insert\(payload\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(s,/\.delete\(\)\.eq\("id", row\.id\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(s,/Update not confirmed; check permissions/);
 assert.match(s,/Creation not confirmed; inspect records/);
 assert.match(s,/Deletion not confirmed; check permissions/);
 assert.match(s,/Write outcome unknown; inspect refreshed records/);
 assert.match(s,/!Number\.isFinite\(Number\(form\[f\.name\]\)\)/);
});
test("candidate writes remain paused and server RPC routing intact",()=>{
 assert.match(s,/candidateMutationPaused = module === "candidates" && LEGACY_CANDIDATE_WRITES_PAUSED/);
 assert.match(s,/if \(candidateMutationPaused\) \{ toast\.error\(CANDIDATE_MUTATION_HOLD_REASON\); return; \}/);
 assert.match(s,/saveCandidateRecord\(\{/);
 assert.match(board,/changeCandidateStage\(\{ candidateId, expectedStage: candidate\.stage, newStage \}\)/);
});
