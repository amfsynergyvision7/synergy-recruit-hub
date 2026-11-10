import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./metadata-snapshot-readonly.sql',import.meta.url),'utf8');
const statements=sql.replace(/--[^\n]*/g,'').split(';').map(x=>x.trim()).filter(Boolean);
test('metadata inventory is SELECT-only and never queries business rows',()=>{
 assert.equal(statements.length,12,'all twelve metadata inventories must remain present');
 for(const stmt of statements){
  assert.match(stmt,/^SELECT\b/i);
  const withoutLiterals=stmt.replace(/'(?:''|[^'])*'/g,"''");
  assert.doesNotMatch(withoutLiterals,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY|DO|CALL|EXECUTE)\b/i);
  assert.match(stmt,/(?:pg_|information_schema)/i);
 }
 assert.doesNotMatch(sql,/\b(?:FROM|JOIN)\s+(?:public\.|auth\.|storage\.)/i);
});
test('schema contract covers policies, RLS, grants, columns, views, functions, triggers and constraints',()=>{
 for(const item of ['pg_policies','relrowsecurity','role_table_grants','column_privileges','pg_get_viewdef','pg_get_functiondef','pg_trigger','pg_constraint','pg_attribute','has_table_privilege']){
  assert.ok(sql.includes(item),'metadata recipe missing '+item);
 }
});
