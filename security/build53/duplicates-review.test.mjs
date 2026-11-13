import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDuplicateReviewCSV } from "../../src/lib/duplicate-review-export.ts";
const ui=readFileSync("src/routes/_app.duplicates.tsx","utf8");
test("candidate duplicate export contains only IDs and review status",()=>{
 const keep="11111111-1111-4111-8111-111111111111";
 const remove="22222222-2222-4222-8222-222222222222";
 const other="33333333-3333-4333-8333-333333333333";
 const csv=buildDuplicateReviewCSV([
  {clusterId:"A",matchedOn:["email","name"],members:[{id:keep},{id:remove}]},
  {clusterId:"B",matchedOn:["phone"],members:[{id:other}]}
 ],new Set([remove]));
 assert.match(csv,/review_group,retain_candidate_id/);
 assert.match(csv,/manual_review_only,NOT_APPROVED/);
 assert.match(csv,/email\|name/);
 assert.ok(csv.includes(keep+","+remove));
 assert.doesNotMatch(csv,/delete|DROP TABLE|update candidates/i);
 assert.equal(csv.trim().split("\n").length,2);
});
test("export never selects every record or accepts unsafe/untrusted IDs",()=>{
 const a="11111111-1111-4111-8111-111111111111";
 const b="22222222-2222-4222-8222-222222222222";
 const c=[{clusterId:"A",matchedOn:["email"],members:[{id:a},{id:b}]}];
 assert.equal(buildDuplicateReviewCSV(c,new Set()),null);
 assert.throws(()=>buildDuplicateReviewCSV(c,new Set([a,b])),/requires a valid retained/);
 assert.throws(()=>buildDuplicateReviewCSV(
  [{clusterId:"A",matchedOn:["email"],members:[{id:a},{id:"=HYPERLINK(1)"}]}],
  new Set(["=HYPERLINK(1)"])),/valid IDs/);
});
test("duplicate UI retains unconditional delete hold and offers review CSV only",()=>{
 assert.match(ui,/buildDuplicateReviewCSV\(clusters, selected\)/);
 assert.match(ui,/Export review CSV \(no deletion\)/);
 assert.match(ui,/LEGACY_CANDIDATE_WRITES_PAUSED/);
 assert.doesNotMatch(ui,/\.from\("candidates"\)\.delete\(/);
 assert.match(ui,/toast\.error\(CANDIDATE_MUTATION_HOLD_REASON\)/);
});

test("Build109 failed rescans cannot expose the previous review manifest",()=>{
 assert.match(ui,/const summary = query\.isError \? undefined : query\.data;/);
 assert.match(ui,/if \(!summary \|\| query\.isError \|\| query\.isFetching\)/);
 assert.match(ui,/disabled=\{!summary \|\| query\.isError \|\| query\.isFetching \|\| totalSelected === 0\}/);
 assert.match(ui,/A completed duplicate review scan is required before export/);
});
