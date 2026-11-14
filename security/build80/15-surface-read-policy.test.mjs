import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {READ_TABLES,PRIVATE_DENY_TABLES} from './role-read-oracle.mjs';

const source=readFileSync(new URL('./15-surface-135-read-review-only.rollback.sql',import.meta.url),'utf8');
const executable=source.split('\n').filter(s=>!s.trimStart().startsWith('--')).join('\n');
const policies=[...executable.matchAll(/^CREATE POLICY (b80_read_[a-z_]+) ON public\.([a-z_]+) FOR SELECT TO authenticated\b/gm)];

test('full 15-surface 135-case proposed SQL contains exactly 15 explicit SELECT-only policies',()=>{
 assert.equal(policies.length,15);
 assert.deepEqual(new Set(policies.map(m=>m[2])),new Set(READ_TABLES));
 assert.equal((executable.match(/\bCREATE POLICY\b/g)||[]).length,15);
 assert.doesNotMatch(executable,/\bCREATE POLICY\b[^;]*\bFOR (?:ALL|INSERT|UPDATE|DELETE)\b/gim);
 assert(!policies.some(m=>PRIVATE_DENY_TABLES.includes(m[2])));
});

test('any accidental invocation rolls back, and documented intent excludes current and production deployment',()=>{
 assert.match(source,/REVIEW-ONLY/);
 assert.match(source,/NOT authorized for production, staging or current hosted nonproduction/);
 assert.match(executable,/^BEGIN;/m);
 assert.match(executable,/^ROLLBACK;/m);
 assert.equal((executable.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((executable.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.match(source,/NO POLICY\/HELPER WAS DEPLOYED IN THIS BUILD/);
});

test('private SECURITY DEFINER helper can only inspect signed current user and refuses multi-role elevated accounts',()=>{
 assert.match(executable,/CREATE SCHEMA amf_rls_guard/);
 assert.match(executable,/REVOKE ALL ON SCHEMA amf_rls_guard FROM PUBLIC, anon, authenticated/);
 assert.match(executable,/CREATE FUNCTION amf_rls_guard\.current_has_role\(wanted public\.app_role\)/);
 assert.match(executable,/SECURITY DEFINER\s+SET search_path=''/);
 assert.match(executable,/uid:=auth\.uid\(\)/);
 assert.match(executable,/IF uid IS NULL THEN RETURN false/);
 assert.match(executable,/count\(\*\)=1 AND bool_and\(ur.role=wanted\)/);
 assert.match(executable,/p\.status='approved' AND p\.is_active=true/);
 assert.match(executable,/REVOKE ALL ON FUNCTION amf_rls_guard\.current_has_role\(public\.app_role\)/);
 assert.match(executable,/GRANT EXECUTE ON FUNCTION amf_rls_guard\.current_has_role\(public\.app_role\)\s+TO authenticated/);
 assert.doesNotMatch(executable,/GRANT EXECUTE[^;]+\bTO\s+(?:anon|PUBLIC)/i);
 assert.doesNotMatch(executable,/raw_user_meta_data|user_metadata|app_metadata/i);
 assert.doesNotMatch(executable,/current_has_role\((?:user_id|target_id|uid)\b/);
});

test('anonymous roles receive no read permissions or guard EXECUTE',()=>{
 assert.match(executable,/REVOKE ALL ON public\.audit_logs/);
 assert.match(executable,/FROM anon,authenticated;/);
 assert.match(executable,/GRANT SELECT ON public\.audit_logs/);
 assert.match(executable,/TO authenticated;/);
 assert.doesNotMatch(executable,/^GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)\b/gmi);
 assert.doesNotMatch(executable,/^GRANT\s+SELECT[^;]+\bTO\s+(?:anon|PUBLIC)\s*;/gmi);
 assert.match(executable,/has_function_privilege\('anon','amf_rls_guard\.current_has_role/);
});

test('approved recruiter row ownership requires authenticated subject and not created_by',()=>{
 for(const table of ['candidates','job_openings'])
  assert.match(executable,new RegExp(`CREATE POLICY b80_read_${table}[\\s\\S]*?assigned_recruiter=\\(select auth.uid\\(\\)\\)`));
 for(const table of ['submissions','interviews'])
  assert.match(executable,new RegExp(`CREATE POLICY b80_read_${table}[\\s\\S]*?coalesce\\(candidate_uuid,candidate_id\\)[\\s\\S]*?assigned_recruiter=\\(select auth.uid\\(\\)\\)`));
 assert.doesNotMatch(executable,/USING\s*\(\s*true\s*\)|auth\.jwt\(\)/i);
});

test('finance read is restricted to billing; notification read is admin or personal active recruiter',()=>{
 assert.match(executable,/CREATE POLICY b80_read_billing[\s\S]*?current_has_role\('finance'\)/);
 assert.match(executable,/CREATE POLICY b80_read_notifications[\s\S]*?user_id=\(select auth.uid\(\)\)/);
 const lines=executable.match(/^CREATE POLICY b80_read_\w+ ON public\.\w+ FOR SELECT TO authenticated\n USING[\s\S]*?;/gm)||[];
 assert.equal(lines.length,15);
 const finance=lines.filter(x=>/current_has_role\('finance'\)/.test(x));
 assert.equal(finance.length,1);
 assert(finance[0].includes('public.billing'));
});

test('four other source CRM tables remain deny by default, including email, automation and financial stage history',()=>{
 assert.equal(PRIVATE_DENY_TABLES.length,4);
 for(const table of PRIVATE_DENY_TABLES){
  assert(!policies.some(m=>m[2]===table));
  assert.doesNotMatch(executable,new RegExp(`GRANT SELECT[^;]*public\\.${table}\\b`));
 }
 assert.match(source,/app_settings \(branding decision is separate\)/);
});

test('review package never creates Auth users, external communications or executable finance workflows',()=>{
 assert.doesNotMatch(executable,/\bINSERT INTO\s+(?:auth\.|public\.)|\bUPDATE\s+(?:auth\.|public\.)|\bTRUNCATE\b[^;]*\bpublic\./gi);
 assert.doesNotMatch(executable,/CREATE TRIGGER|ENABLE TRIGGER|CREATE PUBLICATION|SEND_EMAIL|NET\.HTTP_POST/gi);
 assert.match(executable,/t\.tgenabled<>'D'/);
 assert.match(executable,/pg_policies WHERE schemaname='public'/);
});
