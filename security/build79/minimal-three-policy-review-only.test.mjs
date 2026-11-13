import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('minimal-three-policy-review-only.rollback.sql',import.meta.url),'utf8');
// SQL comments explain forbidden patterns; compare negative controls against executable statements only.
const executable=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');

test('proposed RLS pilot is explicitly non-executable without manual review and rollback only',()=>{
 assert.match(sql,/REVIEW-ONLY/);
 assert.match(sql,/NOT applied to nonproduction/);
 assert.match(sql,/^BEGIN;$/m);
 assert.match(sql,/^ROLLBACK;$/m);
 assert.equal((sql.match(/^CREATE POLICY /gm)||[]).length,3);
 assert.equal((sql.match(/^GRANT SELECT ON /gm)||[]).length,1);
 assert.doesNotMatch(sql,/^\s*(INSERT|UPDATE|DELETE|CREATE ROLE|ALTER ROLE|CREATE FUNCTION)\b/gmi);
});

test('self and recruiter-owner policies cannot be role-only or user_metadata based',()=>{
 assert.match(sql,/FOR SELECT TO authenticated USING \(id=\(select auth.uid\(\)\)\)/);
 assert.match(sql,/FOR SELECT TO authenticated USING \(user_id=\(select auth.uid\(\)\)\)/);
 assert.match(sql,/assigned_recruiter=\(select auth.uid\(\)\)/);
 assert.match(sql,/p.status='approved' AND p.is_active/);
 assert.match(sql,/r.role='recruiter'/);
 assert.doesNotMatch(executable,/USING \(true\)|user_metadata|raw_user_meta_data|SECURITY DEFINER/i);
});

test('no grants to anonymous, no mutations, all other sensitive tables remain inaccessible',()=>{
 assert.match(sql,/GRANT SELECT ON public.profiles,public.user_roles,public.candidates TO authenticated;/);
 assert.doesNotMatch(executable,/GRANT\s+[^;]+\b(?:anon|PUBLIC)\b/i);
 assert.doesNotMatch(executable,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)/i);
 assert.match(sql,/has_table_privilege\('anon','public.candidates','SELECT'\)/);
 assert.match(sql,/has_table_privilege\('authenticated','public.candidates','INSERT,UPDATE,DELETE,TRUNCATE'\)/);
});
