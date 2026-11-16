import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of [
  "security/build63/nonprod-hosted-prerequisites.readonly.sql",
  "security/build63/production-security-baseline.readonly.sql",
]) {
  test(path + " is one catalog/count-only SELECT", () => {
    const sql=readFileSync(path,"utf8");
    const withoutComments=sql.replace(/^\s*--.*$/gm,"").trim();
    assert.match(withoutComments,/^SELECT\s/i);
    assert.equal((withoutComments.match(/;/g)||[]).length,1);
    assert.match(withoutComments,/;\s*$/);
    assert.doesNotMatch(withoutComments,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|DO|CALL|EXECUTE|MERGE|COMMIT|BEGIN)\b/i);
    assert.match(withoutComments,/count\(\*\)/);
    assert.doesNotMatch(withoutComments,/pg_read_file|pg_ls_dir|dblink|postgres_fdw/i);
  });
}
