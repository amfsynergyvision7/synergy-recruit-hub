import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL(name,import.meta.url),'utf8');
const harden = read('nonprod-harden-two-definers.sql');
const pinned = read('hardened-lab-preseed.readonly.sql');
const denials = read('hosted-preauth-64-denials.rollback.sql');
const provision = read('provision-nine-auth-users.mjs');

test('only the two original source-pinned SECURITY DEFINER functions are hardened',()=>{
  assert.match(harden,/e400aad0d20359265b58d9718d4f48a4/);
  assert.match(harden,/86c1f9eb50c225a673ae61e82d4e7397/);
  assert.match(harden,/ALTER FUNCTION public\.set_assigned_recruiter\(\) SET search_path = ''/);
  assert.match(harden,/CREATE OR REPLACE FUNCTION public\.track_stage_changes\(\)/);
  assert.match(harden,/INSERT INTO public\.candidate_stage_history/);
  assert.match(harden,/auth\.uid\(\)/);
  assert.match(harden,/REVOKE ALL ON FUNCTION public\.set_assigned_recruiter/);
  assert.match(harden,/REVOKE ALL ON FUNCTION public\.track_stage_changes/);
  assert.match(harden,/t\.tgenabled <> 'D'/);
  assert.doesNotMatch(harden,/\bCREATE TRIGGER\b|\bGRANT EXECUTE\b|\bINSERT INTO auth\.users\b/i);
});

test('new preseed fingerprints represent 30 untouched and exactly 2 hardened function sources',()=>{
  assert.match(pinned,/0b3f5aefd663dae047d866fddc805c96/);
  assert.match(pinned,/1966ef60466b78a94bd0f700a8ae9468/);
  assert.doesNotMatch(pinned,/e400aad0d20359265b58d9718d4f48a4|86c1f9eb50c225a673ae61e82d4e7397/);
  assert.match(pinned,/lab_pinned_app_triggers=32/);
  assert.match(pinned,/TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION/);
  assert.match(pinned,/auth_user_count=0/);
});

test('64 actual SQL denial probes are rollback-only and do not accept any UAT case',()=>{
  assert.match(denials,/^BEGIN;/m);
  assert.match(denials,/^ROLLBACK;/m);
  assert.match(denials,/SET LOCAL ROLE anon;/);
  assert.match(denials,/SET LOCAL ROLE authenticated;/);
  assert.match(denials,/BUILD78_HOSTED_PREAUTH_SQL_DENIAL_64_OF_64_PASS/);
  assert.match(denials,/0::integer AS historical_signed_uat_cases_accepted/);
  assert.equal((denials.match(/\('app_settings'\)/g)||[]).length,2);
  assert.equal((denials.match(/\('vw_submission_filters'\)/g)||[]).length,2);
  assert.doesNotMatch(denials,/^\s*(INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|GRANT)\b/gmi);
});

test('Auth Admin code has exact nonproduction allowlist and never contains secrets',()=>{
  assert.match(provision,/dhlhlasnaapzckjyvffn/);
  assert.match(provision,/auth\.admin|client\.auth\.admin/);
  assert.match(provision,/example\.invalid/);
  assert.match(provision,/email_confirm: true/);
  assert.match(provision,/process\.stderr\.write\('Build78 Auth Admin provisioning HOLD/);
  assert.doesNotMatch(provision,/\bservice_role\s*[:=]\s*['"][A-Za-z0-9_-]{32,}/);
});
