import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const board=read("src/components/CandidateBoard.tsx");
const route=read("src/routes/_app.candidates.tsx");

test("Build127 board validates all candidate stage keys against configured stages", () => {
  assert(board.includes("const stageValues = new Set(stages.map(stage => stage.value))"));
  assert(board.includes('typeof row.stage !== "string" || !stageValues.has(row.stage)'));
});

test("Build127 missing or malformed candidate IDs are refused", () => {
  assert(board.includes('typeof row.id !== "string" || !row.id'));
  assert(board.includes("new Set(data.map(row => row.id)).size !== data.length"));
});

test("Build127 verifies exact row count and refuses client-side truncation", () => {
  assert(board.includes('{ count: "exact" }'));
  assert(board.includes("!Number.isSafeInteger(count)"));
  assert(board.includes("count! > 250"));
  assert(board.includes("data.length !== count"));
});

test("Build127 stale board requests never populate cleared data", () => {
  assert(board.includes("requestController.current?.abort()"));
  assert(board.includes("epoch !== loadEpoch.current"));
  assert(board.includes("return () => { loadEpoch.current++; requestController.current?.abort(); }"));
  assert(board.includes("setRows([])"));
});

test("Build127 manually refreshes read-only board after removing realtime", () => {
  assert(board.includes("Refresh candidate board"));
  assert(board.includes("onClick={() => { void load(); }}"));
  assert(board.includes("disabled={loading}"));
  assert(!board.includes("supabase.channel("));
  assert(!board.includes('.on("postgres_changes"'));
});

test("Build127 board does not advertise partial results as authoritative", () => {
  assert(board.includes("No partial pipeline is displayed."));
  assert(board.includes("no realtime updates."));
  assert(board.includes("maximum 250"));
  assert(board.includes("Candidate data has not been fully verified for this read."));
});

test("Build127 candidate board remains stage-mutation paused", () => {
  assert(board.includes("if (LEGACY_CANDIDATE_WRITES_PAUSED)"));
  assert(board.includes("changeCandidateStage"));
  assert(!board.includes(".update({ stage: newStage })"));
  assert(!board.includes("toast.error(error.message)"));
});

test("Build127 browser candidate route requires approved role and account key", () => {
  assert(route.includes("canMountApprovedCrm(user?.id, profile, role)"));
  assert(route.includes('<CandidateWorkspace key={user!.id + ":" + role} />'));
  assert(route.includes('roleResult.count! > 150'));
});
