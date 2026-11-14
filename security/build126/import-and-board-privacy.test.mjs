import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReadPrivateUserDirectory } from "../../src/lib/crm-sensitive-route-access.ts";

const src = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const importPage = src("src/routes/_app.import.tsx");
const candidatePage = src("src/routes/_app.candidates.tsx");
const board = src("src/components/CandidateBoard.tsx");
const approved = { id: "subject-a", status: "approved", is_active: true };

test("Build126 import access requires current approved administrator", () => {
  assert.equal(canReadPrivateUserDirectory("subject-a", approved, "admin"), true);
  for (const role of ["recruiter", "operations", "finance", "viewer", null])
    assert.equal(canReadPrivateUserDirectory("subject-a", approved, role), false);
  for (const profile of [null, { ...approved, id: "subject-b" },
    { ...approved, status: "suspended" }, { ...approved, is_active: false }])
    assert.equal(canReadPrivateUserDirectory("subject-a", profile, "admin"), false);
});

test("Build126 import page mounts workspace only after verified identity and role", () => {
  assert(importPage.includes("const { user, profile, role, loading } = useAuth()"));
  assert(importPage.includes("if (loading) return"));
  assert(importPage.includes("if (!canReadPrivateUserDirectory(user?.id, profile, role))"));
  assert(importPage.includes("<AdminImportWorkspace key={user!.id} />"));
});

test("Build126 offline import never queries the live CRM or employee directory", () => {
  assert(!importPage.includes("supabase."));
  assert(!importPage.includes("supabase.from("));
  assert(!importPage.includes("useEffect("));
  assert(!importPage.includes("approvedRecruiters"));
  assert(importPage.includes("Offline file checks only"));
});

test("Build126 import preview checks duplicate keys within uploaded file only", () => {
  assert(importPage.includes("const keys = new Set<string>()"));
  assert(importPage.includes("const isDuplicate = !!keyVal && keys.has(keyVal)"));
  assert(importPage.includes("if (keyVal) keys.add(keyVal)"));
  assert(importPage.includes("Repeated key in uploaded file"));
  assert(!importPage.includes("setExistingKeys("));
});

test("Build126 cannot present an unverified CRM record as newly created", () => {
  assert(importPage.includes("Locally valid"));
  assert(importPage.includes("Repeated file keys"));
  assert(!importPage.includes(">New</Badge>"));
  assert(!importPage.includes(">Valid: {validCount}</Badge>"));
});

test("Build126 imported customer data remains protected by the unconditional write hold", () => {
  assert(importPage.includes("if (LEGACY_BULK_IMPORT_WRITES_PAUSED)"));
  assert(importPage.includes("disabled={running || LEGACY_BULK_IMPORT_WRITES_PAUSED}"));
  assert(!importPage.includes(".insert("));
  assert(!importPage.includes(".update("));
  assert(!importPage.includes(".delete("));
});

test("Build126 candidates route mounts only for matching approved account", () => {
  assert(candidatePage.includes("canMountApprovedCrm(user?.id, profile, role)"));
  assert(candidatePage.includes("<CandidateWorkspace key={user!.id + \":\" + role} />"));
});

test("Build126 recruiter picker filters by verified recruiter role and active profile", () => {
  assert(candidatePage.includes('.eq("role", "recruiter")'));
  assert(candidatePage.includes('.in("id", Array.from(ids)).eq("status", "approved")'));
 assert(candidatePage.includes('.eq("is_active", true)'));
  assert(candidatePage.includes('.select("id, full_name", { count: "exact" })'));
  assert(!candidatePage.includes(".select('id, full_name, email')"));
});

test("Build126 recruiter picker rejects incomplete, duplicate and stale reads", () => {
  const helper=src("src/lib/recruiter-selector-read.ts");
  assert(candidatePage.includes("readVerifiedRecruiterChoices("));
  assert(helper.includes("readBoundedReportRows(readRoles, signal)"));
  assert(helper.includes("userIds.has(row.user_id)"));
  assert(helper.includes("reply.count! > chunk.length"));
  assert(helper.includes("reply.data.length !== reply.count"));
  assert(candidatePage.includes("controller.abort()"));
  assert(candidatePage.includes("if (!current || controller.signal.aborted) return"));
});

test("Build126 board rejects capped data with Build131 exact ID pagination", () => {
  assert(board.includes('{ count: "exact" }'));
  assert(board.includes("readCompleteCrmRows((from, to, signal) =>"));
  assert(board.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
  const helper=src("src/lib/bounded-report-read.ts");
  assert(helper.includes("if (result.count! > REPORT_MAX_ROWS)"));
  assert(helper.includes("if (result.data.length !== needed)"));
  assert(helper.includes("seen.has(row.id)"));
  assert(board.includes("No partial pipeline is displayed"));
});

test("Build126 candidate board aborts previous and unmounted requests", () => {
  assert(board.includes("requestController.current?.abort()"));
  assert(board.includes("epoch !== loadEpoch.current"));
  assert(board.includes("return () => { loadEpoch.current++; requestController.current?.abort(); }"));
  assert(board.includes(".abortSignal(signal)"));
});

test("Build126 board no longer subscribes to all candidate events or leaks backend errors", () => {
  assert(!board.includes('supabase.channel('));
  assert(!board.includes('.on("postgres_changes"'));
  assert(!board.includes("toast.error(error.message)"));
  assert(board.includes("Candidate stage change could not be verified."));
});
