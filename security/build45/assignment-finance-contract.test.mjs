import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(p,'utf8');
const rpc=read('security/build43/candidate-row-commit-review-only.sql');
const rowTest=read('security/build43/atomic-row-commit.integration.sql');
const fixture=read('security/build44/production-trigger-compat.integration.sql');
const source=read('src/lib/sheets-sync.server.ts');
const manual=read('src/lib/integrations.functions.ts');
const ui=read('src/routes/_app.integrations.tsx');
const baseline=read('security/build45/financial-automation-baseline.integration.sql');
const hold=read('security/build45/financial-automation-hold-review-only.sql');
const holdTest=read('security/build45/financial-hold-rehearsal.integration.sql');

test('atomic RPC requires explicit assigned recruiter as separate typed parameter',()=>{
 assert.match(rpc,/p_candidate jsonb,p_assigned_recruiter uuid/);
 assert.match(rpc,/INSERT INTO public\.candidates\(/);
 assert.match(rpc,/source,notes,stage,status,created_source,assigned_recruiter/);
 assert.match(rpc,/google_form_sync',p_assigned_recruiter/);
});
test('only an approved, active user with recruiter role is eligible',()=>{
 assert.match(rpc,/p\.id=p_assigned_recruiter AND p\.status='approved'/);
 assert.match(rpc,/p\.is_active IS TRUE AND r\.role='recruiter'/);
 assert.match(rpc,/Approved active recruiter assignment required/);
});
test('candidate source JSON cannot spoof recruiter assignment',()=>{
 assert.doesNotMatch(rpc,/p_candidate->>'assigned_recruiter'/);
 assert.match(rpc,/Unsupported candidate keys/);
 assert.doesNotMatch(rpc,/ARRAY\[[^\]]*'assigned_recruiter'/s);
});
test('release configuration requires a valid non-empty recruiter UUID before any sheet access',()=>{
 const start=source.indexOf('const assignedRecruiterId = process.env.CANDIDATE_SYNC_ASSIGNED_RECRUITER_ID');
 const load=source.indexOf('const integ = await getSavedGoogleIntegration',start);
 assert.ok(start>0&&load>start);
 assert.match(source,/Candidate sync requires an approved recruiter assignment configuration/);
 assert.match(source,/p_assigned_recruiter: assignedRecruiterId/);
});
test('all per-row SQL fixtures cover the new six-argument signature',()=>{
 for(const s of [rpc,rowTest,fixture]){
  assert.match(s,/crm_commit_candidate_sync_row\(uuid,uuid,uuid,integer,jsonb,uuid\)/);
  assert.doesNotMatch(s,/crm_commit_candidate_sync_row\(uuid,uuid,uuid,integer,jsonb\)/);
 }
});
test('wrong, pending, inactive and absent recruiter assignment cases are denied',()=>{
 for(const phrase of ['pending recruiter accepted','inactive recruiter accepted','missing recruiter accepted','explicit approved recruiter not preserved'])
   assert.ok(rowTest.includes(phrase),phrase);
});
test('manual sync is off without a separate release toggle and surfaces failures',()=>{
 assert.match(manual,/CANDIDATE_SYNC_MANUAL_ENABLED !== "true"/);
 assert.match(manual,/execution\.value\.errors !== 0/);
 assert.match(ui,/Sync new rows \(paused\)/);
 assert.doesNotMatch(ui,/syncMut\.mutate\(false\)/);
});
test('real source-derived baseline proves joined stage currently has financial side effects',()=>{
 assert.match(baseline,/UPDATE public\.candidates SET stage='joined'/);
 assert.match(baseline,/bill\.placement_fee<>8330/);
 assert.match(baseline,/bill\.gst<>1499\.4/);
 assert.match(baseline,/bill\.invoice_amount<>9829\.4/);
 assert.match(baseline,/RELEASE GATE NOT MET/);
});
test('financial hold is review-only and removes automatic billing insert but preserves other branches',()=>{
 assert.match(hold,/REVIEW ONLY/);
 assert.match(hold,/ELSIF NEW\.stage = 'joined' THEN/);
 assert.doesNotMatch(hold,/INSERT INTO public\.billing/);
 for(const t of ["submitted_to_client","interview_scheduled","offer_released"])
   assert.ok(hold.includes("NEW.stage = '"+t+"'"),t);
});
test('financial hold synthetic rehearsal preserves joined stage and custom workflow notification without creating billing',()=>{
 assert.match(holdTest,/financial hold leaked automatic billing/);
 assert.match(holdTest,/financial hold broke unrelated recruiter workflow/);
 assert.match(holdTest,/joined stage change blocked by financial hold/);
 assert.match(holdTest,/ROLLBACK;/);
});
test('no live deploy migration or production financial activation is added',()=>{
 assert.ok(!read('security/build45/README.md').includes('approved for production'));
 assert.match(hold,/NOT an active migration/);
 assert.match(holdTest,/REVIEW-ONLY FINANCIAL HOLD/);
});
