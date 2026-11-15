import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,existsSync} from "node:fs";
import {join,dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const local="security/lead-discovery/fixtures/release-progress/";
const data=f=>readFileSync(join(root,local+f));
const read=f=>JSON.parse(data(f).toString("utf8"));
const blobSha=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b
 ])).digest("hex");
test("Build171 removes historical canonical-looking current scoreboard from main-targeted cut",()=>{
 assert(!existsSync(join(root,"security/release-progress/current.json")));
 assert(!existsSync(join(root,"security/release-progress/v1-rubric.json")));
 assert(existsSync(join(root,local+"build138-current.snapshot.json")));
 assert(existsSync(join(root,local+"v1-rubric.snapshot.json")));
});
test("Build171 frozen Build138 record is byte-identical to reviewed source Git blob",()=>{
 assert.equal(blobSha(data("build138-current.snapshot.json")),
 "52bf1a6ca0dd4c31fbbd2ab1de05a1b40597100b");
 assert.equal(blobSha(data("v1-rubric.snapshot.json")),
 "228aa78f16bb15c088b9094e1deb5c849083aee1");
});
test("Build171 historical reference cannot be represented as operational live readiness",()=>{
 const a=read("build138-current.snapshot.json"),b=read("v1-rubric.snapshot.json");
 assert.equal(a.snapshot_build,138);
 assert.equal(a.as_of,"2026-11-14");
 assert.equal(a.expected_earned_points,26);
 assert.equal(a.observations.git.main_protected,false);
 assert.equal(b.fixed,true);
 assert.equal(b.milestones.filter(m=>m.group==="LD").reduce((n,m)=>n+m.weight,0),10);
});
test("Build171 Category C ledger has a scoped local historical fixture source",()=>{
 const ledger=JSON.parse(readFileSync(join(root,"security/lead-discovery/category-c-v1.json"),"utf8"));
 const f=ledger.frozen_evidence_fixture;
 assert.equal(f.scope,"ISOLATED_CATEGORY_C_TEST_REFERENCE_NOT_LIVE_RELEASE_STATUS");
 assert.equal(f.snapshot_build,138);
 assert.equal(ledger.formal_rubric,"security/lead-discovery/fixtures/release-progress/v1-rubric.snapshot.json");
 assert.equal(ledger.formal_earned_points,6);
 assert.equal(ledger.review_package.LD02.accepted,false);
 assert.equal(ledger.review_package.LD05.accepted,false);
 assert.equal(f.official_points_not_recalculated,true);
});
test("Build171 workflow protects no-merge hold and includes frozen evidence tests",()=>{
 const workflow=readFileSync(join(root,".github/workflows/build165-category-c.yml"),"utf8");
 assert(workflow.includes("security/build171-lead-category/frozen-scorecard.test.mjs"));
 assert(workflow.includes("main-release-hold:"));
 assert(workflow.includes("exit 1"));
 assert(!workflow.includes("workflow_dispatch:"));
});
