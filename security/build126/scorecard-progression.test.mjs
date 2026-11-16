import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";

const read = (name) => JSON.parse(readFileSync(new URL("../release-progress/" + name, import.meta.url), "utf8"));
const rubric = read("v1-rubric.json");
const previous = read("build125-evidence-baseline.json");
const current = read("build126-evidence-baseline.json");

test("Build126 exact full-program score holds at 26/100 until independent acceptance", () => {
  assert.equal(previous.snapshot_build, 125);
  assert.equal(current.snapshot_build, 126);
  assert.equal(current.previous_file, "build125-evidence-baseline.json");
  assert.deepEqual(compareSnapshots(rubric, previous, current), {
    previous: 26, current: 26, delta: 0, newGates: [], regressed: [],
  });
  assert.equal(evaluate(rubric, current).completed_milestones, 12);
  assert.equal(evaluate(rubric, current).remaining, 74);
});

test("Build126 cannot silently reweight, remove or self-accept any of the fixed 43 gates", () => {
  assert.equal(previous.statuses.length, 43);
  assert.equal(current.statuses.length, 43);
  const prior = new Map(previous.statuses.map(row => [row.id, row.complete]));
  for (const row of current.statuses) assert.equal(row.complete, prior.get(row.id), row.id);
  assert.equal(evaluate(rubric, current).closedWorkstreams, 0);
});

test("Build126 observed source fixes are explicitly separate from hosted and production acceptance", () => {
  const x = current.observations.import_board_privacy;
  assert.equal(x.stage, "DRAFT_LOCAL_PREVIEW_AND_ROLE_SCOPED_BROWSER_ONLY");
  assert.equal(x.import_reads_private_crm_tables, false);
  assert.equal(x.importer_requires_verified_admin, true);
  assert.equal(x.imported_file_duplicates_checked_locally, true);
  assert.equal(x.existing_record_conflicts_verified, false);
  assert.equal(x.candidate_board_partial_counts_refused, true);
  assert.equal(x.candidate_board_unfiltered_realtime_enabled, false);
  assert.equal(x.candidate_board_cap, 250);
  assert.equal(x.recruiter_lookup_email_directory_read, false);
  assert.equal(x.hosted_signed_uat_accepted, 0);
  assert.equal(x.independent_rls_review_accepted, false);
  assert.equal(x.staging_or_production_writes, 0);
  assert.equal(x.finance_or_ai_external_effects_enabled, false);
});

test("Build126 cannot claim release acceptance without gate evidence", () => {
  for (const id of ["CRM05", "CRM06", "CRM07", "CRM08", "CRM09",
    "REL01", "REL02", "REL03", "REL04", "REL05", "REL06", "REL07",
    "BI01", "BI02", "BI03", "BI04", "BI05"]) {
    assert.equal(current.statuses.find(row => row.id === id)?.complete, false, id);
  }
  const fabricated = structuredClone(current);
  const gate = fabricated.statuses.find(row => row.id === "REL02");
  gate.complete = true;
  gate.evidence = [];
  assert.throws(() => evaluate(rubric, fabricated), /Completed gate lacks evidence/);
});
