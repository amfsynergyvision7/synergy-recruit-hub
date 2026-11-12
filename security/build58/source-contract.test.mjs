import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("security/build58/function-search-path-review-only.sql","utf8");
const fixture=readFileSync("security/build58/exact-four-function-replay.integration.sql","utf8");
const pre=readFileSync("security/build58/live-function-preflight.sql","utf8");
test("four drift-checked function fixes remove anon and pin qualified paths",()=>{
 assert.match(sql,/ea5005b2208a2d0891e3f8004fd7de80/);
 for(const x of ["get_recruiter_stats","search_candidates","set_assigned_recruiter","track_stage_changes"])
  assert.match(sql,new RegExp("ALTER FUNCTION public\\."+x+"\\("));
 assert.equal((sql.match(/SET search_path=pg_catalog,public;/g)||[]).length,4);
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.set_assigned_recruiter/);
 assert.match(sql,/p\.proconfig @> ARRAY/);
});
test("real source fixture is a single rollback with behavior tests",()=>{
 assert.equal((fixture.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((fixture.match(/^COMMIT;$/gm)||[]).length,0);
 assert.equal((fixture.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.match(fixture,/DO \$b58_behavior\$/);
 assert.match(fixture,/DO \$b58_anon\$/);
 assert.match(pre,/MATCH_SOURCE_ONLY_NOT_APPROVAL/);
});
