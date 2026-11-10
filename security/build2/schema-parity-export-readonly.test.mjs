import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SECTIONS} from './schema-parity.mjs';
const sql=readFileSync(new URL('./schema-parity-export-readonly.sql',import.meta.url),'utf8');
const withoutComments=sql.replace(/--[^\n]*/g,'').trim();
test('export is a single read-only SELECT with no business-row queries',()=>{
 assert.match(withoutComments,/^SELECT\s+jsonb_build_object\(/i);
 assert.equal((withoutComments.match(/;\s*$/g)||[]).length,1);
 assert.doesNotMatch(withoutComments,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY|DO|CALL|EXECUTE)\b/i);
 assert.doesNotMatch(withoutComments,/\b(?:FROM|JOIN)\s+(?:public|auth|storage)\./i);
});
test('all nine comparator sections are exported exactly once',()=>{
 for(const section of SECTIONS){
  const occurrences=sql.match(new RegExp("'"+section+"',COALESCE\\(","g"))||[];
  assert.equal(occurrences.length,1,section);
 }
});
test('export includes security-critical definitions and grants',()=>{
 for(const expression of ['relrowsecurity','relforcerowsecurity','pg_get_viewdef','pg_get_functiondef','pg_get_triggerdef','pg_get_indexdef','pg_get_constraintdef','pg_policies','has_table_privilege','pg_get_function_identity_arguments']){
  assert.ok(sql.includes(expression),expression);
 }
});
