import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const dir="/tmp/build54-release-review";
const sha=(s)=>createHash("sha256").update(s).digest("hex");
const read=(p)=>readFileSync(p,"utf8");
test("review bundle has unconditional first-statement stop and NO commit",()=>{
 const sql=read(dir+"/release-review-hold.sql");
 assert.match(sql,/^-- Build54 REVIEW ONLY/);
 assert.ok(sql.includes("DO $build54_release_hold$"));
 assert.ok(!sql.includes("CREATE POLICY") && !sql.includes("CREATE OR REPLACE") && !sql.includes("DROP POLICY"));
 assert.match(sql,/RAISE EXCEPTION 'Build54 release BLOCKED/);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,0);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,0);
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,0);
 assert.match(sql,/END OF NON-EXECUTABLE HOLD FILE/);
});
test("atomic bundle includes EXACT four pinned sources, all grants and counts",()=>{
 const m=JSON.parse(read(dir+"/manifest.json"));
 assert.equal(m.state,"NON_EXECUTABLE_REVIEW_HOLD");
 assert.equal(m.old_policy_count,67);
 assert.equal(m.replacement_policy_count,35);
 assert.equal(m.old_policy_fingerprint,"a70190f31ed8436b2989082898a02b51");
 assert.equal(m.no_release_authorization,true);
 assert.equal(m.candidate_rpc_count,4);
 assert.equal(m.financial_hold_trigger_count,2);
 assert.equal(Object.keys(m.source_sha256).length,6);
 const sql=read(dir+"/release-review-hold.sql");
 const review=read(dir+"/release-candidate-HUMAN-REVIEW.md");
 assert.equal(m.review_bundle_sha256,sha(sql));
 assert.equal(m.review_document_sha256,sha(review));
 assert.equal(m.sql_hold_contains_no_migration_ddl,true);
 for(const [p,h] of Object.entries(m.source_sha256))
   assert.equal(sha(read(p)),h);
 for(const name of ["crm_admin_manage_user","crm_update_own_profile",
   "crm_change_candidate_stage","crm_write_candidate","crm_import_candidates_atomic","crm_candidate_delete_impact","crm_hold_unapproved_joined_transitions"])
  assert.ok(review.includes("public."+name+"("));
});
test("rehearsal contains exact policies, candidate tests, and only ROLLBACK",()=>{
 const sql=read(dir+"/full-release-rollback.integration.sql");
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,0);
 assert.ok(sql.includes("DO $build53_combined$"));
 assert.ok(sql.includes("DO $b49_integration$"));
 assert.ok(sql.includes("DO $build54_postflight$"));
 assert.ok(sql.includes("DO $b55_full_release$"));
 assert.ok(sql.includes("DO $b56_full_finance$"));
 assert.ok(sql.includes("a70190f31ed8436b2989082898a02b51"));
 assert.equal(sha(sql),read(dir+"/rehearsal-sha256.txt").trim());
});
