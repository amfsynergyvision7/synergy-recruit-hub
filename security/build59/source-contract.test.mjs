import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const sql=read("security/build59/13-view-write-acl-review-only.sql");
const pre=read("security/build59/live-view-catalog-preflight.sql");
const cases=read("security/build59/full-policy-view-cases.sql");
test("13 exact source views are invoker and DML restricted with signed-in READ retained",()=>{
 assert.match(sql,/a90d4a1fab9552d47697127888e10d19/);
 assert.match(sql,/REVOKE ALL PRIVILEGES ON TABLE public\.%I/);
 assert.match(sql,/REVOKE INSERT\(%s\),UPDATE\(%s\),REFERENCES\(%s\)/);
 assert.match(sql,/GRANT SELECT ON TABLE public\.%I TO authenticated,service_role/);
 assert.match(sql,/security_invoker=true/);
 assert.match(sql,/has_any_column_privilege/);
 assert.doesNotMatch(sql,/(?:^|\n)COMMIT;/);
});
test("live catalog query counts source view grant exposure without candidate rows",()=>{
 assert.match(pre,/EXACT_LIVE_LEGACY_VIEW_SURFACE_REVIEW_ONLY/);
 assert.match(pre,/anon_read_views=13/);
 assert.match(pre,/signed_update_grant_views=13/);
 assert.doesNotMatch(pre,/\b(?:ALTER VIEW|REVOKE ALL|INSERT INTO|DELETE FROM|TRUNCATE TABLE)\b/i);
});
test("role tests cover all 13 views plus inactive and anonymous isolation",()=>{
 assert.match(cases,/DO \$b59_full_views\$/);
 assert.match(cases,/DO \$b59_recruiter_view\$/);
 assert.match(cases,/DO \$b59_anon_view\$/);
 assert.match(cases,/security_invoker=true/);
});
