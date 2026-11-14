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
  const paging=read("src/lib/bounded-report-read.ts");
  assert(paging.includes("seen.has(row.id)"));
  assert(paging.includes('typeof row.id !== "string" || !row.id'));
});

test("Build127 still verifies exact count with complete Build131 ID pages", () => {
  assert(board.includes('{ count: "exact" }'));
  assert(board.includes("readCompleteCrmRows((from, to, signal) =>"));
  const paging=read("src/lib/bounded-report-read.ts");
  assert(paging.includes("!Number.isSafeInteger(result.count)"));
  assert(paging.includes("result.count! > REPORT_MAX_ROWS"));
  assert(paging.includes("result.data.length !== needed"));
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
  assert(board.includes("maximum ${CRM_MAX_ROWS}"));
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
