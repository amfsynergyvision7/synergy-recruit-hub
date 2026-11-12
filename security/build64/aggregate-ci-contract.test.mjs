import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("CI summary depends on EVERY substantive job, not the deliberate hold",()=>{
 const workflow=readFileSync(".github/workflows/security-build34-review.yml","utf8");
 const declared=[...workflow.matchAll(/^  ([a-z][a-z0-9-]+):\s*$/gm)]
  .map(m=>m[1])
  .filter(n=>!["push","substantive-security-summary","production-release-hold"].includes(n));
 const chunk=workflow.split("  substantive-security-summary:\n")[1]?.split("\n  production-release-hold:")[0];
 assert.ok(chunk,"required aggregate job missing or after release hold");
 const needed=[...chunk.matchAll(/^      - ([a-z][a-z0-9-]+)\s*$/gm)].map(m=>m[1]);
 assert.equal(declared.length,32);
 assert.equal(needed.length,declared.length);
 assert.deepEqual(new Set(needed),new Set(declared));
 assert.ok(!needed.includes("production-release-hold"));
 assert.match(chunk,/if: always\(\)/);
 assert.match(chunk,/len\(results\)!=32 or failed/);
 assert.match(chunk,/build65-substantive-ci-summary\.json/);
 assert.match(chunk,/source_sha/);
 assert.match(chunk,/expected_substantive_jobs/);
 assert.match(chunk,/all_substantive_pass/);
 assert.match(chunk,/release_hold_excluded/);
 assert.match(chunk,/uses: actions\/upload-artifact@v4/);
 const hold=workflow.split("  production-release-hold:\n")[1];
 assert.match(hold,/exit 1/);
});
