import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const coverage=JSON.parse(readFileSync("security/build65/production-hosted-coverage.json","utf8"));
const sql=readFileSync("security/build66/extra-public-surfaces.readonly.sql","utf8");
test("catalog-only public-surface inventory is precisely 4 omitted tables and 13 views",()=>{
 const rows=[...sql.matchAll(/\('([a-z_]+)','(table|view)'\)/g)]
  .map(x=>({name:x[1],kind:x[2]}));
 assert.equal(rows.length,17);
 assert.deepEqual(rows.filter(x=>x.kind==="table").map(x=>x.name),
  coverage.uncovered_production_tables);
 assert.deepEqual(rows.filter(x=>x.kind==="view").map(x=>x.name),
  coverage.uncovered_production_views);
 assert.equal(new Set(rows.map(x=>x.name)).size,17);
});
test("catalog review contains one read-only SELECT, not a SQL mutation",()=>{
 const withoutComments=sql.replace(/^\s*--.*$/gm,"").trim();
 assert.match(withoutComments,/^WITH expected\(name,kind\) AS \(/);
 assert.equal((withoutComments.match(/;/g)||[]).length,1);
 assert.match(withoutComments,/ORDER BY e\.kind,e\.name;\s*$/);
 assert.doesNotMatch(withoutComments,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|DO|CALL|EXECUTE|COPY|COMMIT|BEGIN)\b/im);
 assert.match(withoutComments,/pg_catalog\.pg_class/);
 assert.match(withoutComments,/pg_catalog\.pg_policies/);
 assert.match(withoutComments,/anon_select_granted/);
 assert.match(withoutComments,/view_is_security_invoker/);
});
