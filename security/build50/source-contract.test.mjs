import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const safety = read("src/lib/release-safety.ts");
const crud = read("src/components/CrudModule.tsx");
const board = read("src/components/CandidateBoard.tsx");
const importPage = read("src/routes/_app.import.tsx");
const duplicates = read("src/routes/_app.duplicates.tsx");
const workflow = read(".github/workflows/security-build34-review.yml");

test("candidate and import holds are unconditional, not bypassable by client environment flags", () => {
  assert.match(safety, /LEGACY_CANDIDATE_WRITES_PAUSED = true as const/);
  assert.match(safety, /LEGACY_BULK_IMPORT_WRITES_PAUSED = true as const/);
  assert.doesNotMatch(safety, /import\.meta\.env|process\.env/);
});

test("candidate CRUD create/edit/delete and bulk mutations use the hold", () => {
  assert.match(crud, /module === "candidates" && LEGACY_CANDIDATE_WRITES_PAUSED/);
  for (const fn of ["save", "remove", "bulkDelete", "applyBulkEdit"]) {
    assert.match(crud, new RegExp('const ' + fn + ' = async \\(.*?=> \\{\\n    if \\(candidateMutationPaused\\)'));
  }
  assert.match(crud, /canDelete\(role\) && !candidateMutationPaused/);
  assert.match(crud, /CANDIDATE_MUTATION_HOLD_REASON/);
});

test("candidate board stage transition cannot optimistically move or write while held", () => {
  assert.match(board, /canEdit\(role, "candidates"\) && !LEGACY_CANDIDATE_WRITES_PAUSED/);
  const guard = board.indexOf("if (LEGACY_CANDIDATE_WRITES_PAUSED)", board.indexOf("const moveCandidate"));
  const rpcCall = board.indexOf('changeCandidateStage({ candidateId, expectedStage: candidate.stage, newStage })', guard);
  assert.ok(guard > 0 && rpcCall > guard);
  assert.doesNotMatch(board, /\.from\("candidates" as any\)\.update\(/);
  assert.match(board, /draggable=\{editable\}/);
  assert.match(board, /isReviewableStageTarget\(stage.value\)/);
});

test("legacy Excel and CSV import has zero direct client row writes", () => {
  assert.doesNotMatch(importPage, /\.from\(schema\.table as any\)\.insert\(/);
  assert.doesNotMatch(importPage, /\.from\(schema\.table as any\)\.update\(/);
  assert.match(importPage, /disabled=\{running \|\| LEGACY_BULK_IMPORT_WRITES_PAUSED\}/);
  assert.match(importPage, /toast\.error\(BULK_IMPORT_HOLD_REASON\)/);
});

test("duplicate deletion no longer contains direct candidate DELETE", () => {
  assert.doesNotMatch(duplicates, /\.from\("candidates"\)\.delete\(/);
  assert.match(duplicates, /selectedCount === 0 \|\| deleting \|\| LEGACY_CANDIDATE_WRITES_PAUSED/);
  assert.match(duplicates, /toast\.error\(CANDIDATE_MUTATION_HOLD_REASON\)/);
});

test("CI enforces Build50 contracts and production release hold remains deliberate", () => {
  assert.match(workflow, /build50-browser-write-safety:/);
  assert.match(workflow, /security\/build50\/source-contract\.test\.mjs/);
  assert.match(workflow, /production-release-hold:/);
  assert.match(workflow, /exit 1/);
});
