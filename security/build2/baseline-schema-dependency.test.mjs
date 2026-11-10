import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql','utf8');
const queue=readFileSync('security/build2/migration-review-queue.mjs','utf8');
test('baseline original migration requires auth-owned user schema',()=>{
 assert.match(sql,/REFERENCES auth\.users\s*\(id\)/i);
 assert.match(sql,/CREATE TABLE public\.profiles/i);
 assert.match(sql,/CREATE TABLE public\.user_roles/i);
});
test('baseline includes role and approval SECURITY DEFINER functions',()=>{
 for(const fn of ['has_role','is_approved','get_user_role']){
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\('));
 }
 assert.ok((sql.match(/SECURITY DEFINER/gi)||[]).length>=3);
});
test('baseline has RLS policies and financial schema requiring separate review',()=>{
 assert.match(sql,/CREATE POLICY/i);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/CREATE TABLE public\.billing\b/i);
});
test('baseline stays blocked: static dependency tests are not original migration replay',()=>{
 assert.match(queue,/baseline_schema.*20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80\.sql/);
});
