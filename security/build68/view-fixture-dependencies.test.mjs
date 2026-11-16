import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CONTROL_SURFACES} from "./hosted-positive-controls.mjs";
import {PUBLIC_VIEWS,PRIVATE_EXTRA_TABLES}
 from "../build66/hosted-anon-extra-scope.mjs";

const doc=JSON.parse(readFileSync("security/build68/view-fixture-dependencies.json","utf8"));
const sql=readFileSync("security/build68/view-direct-dependencies.readonly.sql","utf8");

test("catalog view dependencies cover all thirteen actual production public views",()=>{
 assert.equal(doc.view_count,13);
 assert.equal(Object.keys(doc.views).length,13);
 assert.deepEqual(Object.keys(doc.views),PUBLIC_VIEWS);
 assert.equal(doc.direct_dependency_edge_count,17);
 assert.equal(Object.values(doc.views).flat().length,17);
 assert.deepEqual(Object.values(doc.views).map(x=>x.length),
  [1,1,2,2,2,2,1,1,1,1,1,1,1]);
 assert.equal(Object.values(doc.views).every(a=>a.length&&a.every(x=>typeof x==="string")),true);
});
test("fixture source graph has eight direct base tables and twelve total source-table candidates",()=>{
 const actualSources=[...new Set(Object.values(doc.views).flat())].sort();
 assert.equal(actualSources.length,8);
 assert.equal(doc.distinct_direct_base_table_count,8);
 assert.deepEqual(actualSources,doc.distinct_direct_base_tables);
 const all=[...new Set([...actualSources,...PRIVATE_EXTRA_TABLES,"app_settings"])].sort();
 assert.equal(all.length,12);
 assert.deepEqual(doc.fixture_source_tables_to_consider,all);
 assert.deepEqual(doc.additional_private_positive_control_tables,PRIVATE_EXTRA_TABLES);
 assert.equal(doc.public_branding_fixture_table,"app_settings");
 assert.deepEqual(CONTROL_SURFACES,[...PRIVATE_EXTRA_TABLES,...PUBLIC_VIEWS]);
 assert.equal(doc.intended_positive_control_surfaces,16);
 assert.equal(doc.provisioning_status,"NOT_PERFORMED");
 assert.ok(doc.safety_notices.some(x=>x.includes("does not imply")));
});
test("view dependency query is a single catalog-only SQL read",()=>{
 const source=sql.replace(/^\s*--.*$/gm,"").trim();
 assert.match(source,/^SELECT v\.relname/);
 assert.match(source,/pg_catalog\.pg_class/);
 assert.match(source,/pg_catalog\.pg_rewrite/);
 assert.match(source,/pg_catalog\.pg_depend/);
 assert.equal((source.match(/;/g)||[]).length,1);
 assert.match(source,/ORDER BY v\.relname,source_kind,source_object;$/);
 assert.doesNotMatch(source,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|DO|CALL|EXECUTE|COPY|COMMIT|BEGIN)\b/im);
});
