import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("security/build55/live-dependency-preflight.sql","utf8");
test("live FK and candidate-trigger catalog digests are exact-source anchored",()=>{
 assert.match(sql,/fk_count=11/);
 assert.match(sql,/fk_digest='84fe09e127229b017c85b05d9a49da21'/);
 assert.match(sql,/candidate_trigger_count=7/);
 assert.match(sql,/candidate_trigger_digest='b0d55f339dc38c0a2efd61dfe82f0b6a'/);
 assert.match(sql,/DRIFT_BLOCK_RELEASE/);
 assert.match(sql,/MATCH_READ_ONLY_NOT_RELEASE_AUTHORIZATION/);
 assert.match(sql,/pg_get_constraintdef\(con\.oid,true\)/);
 assert.match(sql,/pg_get_triggerdef\(t\.oid,true\)/);
});
test("read-only catalog query contains no DML or DDL statements",()=>{
 const body=sql.replace(/^--.*$/gm,"");
 assert.doesNotMatch(body,/\b(?:INSERT INTO|UPDATE\s+public|DELETE FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE|TRUNCATE|EXECUTE|GRANT|REVOKE|COMMIT)\b/i);
 assert.match(body,/WITH foreign_keys AS/);
 assert.match(body,/SELECT fk_count,fk_digest/);
});
