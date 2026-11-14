import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const original=JSON.parse(read('security/build48/live-67-policy-catalog.json'));
const replay=read('security/build48/live-67-policy-replay.fixture.sql');
const migration=read('security/build48/67-policy-full-replacement-review-only.sql');
const fixture=read('security/build48/67-policy-replacement.integration.sql');
test('catalog snapshot contains 67 source policies over 18 tables',()=>{
 assert.equal(original.count,67);assert.equal(original.tables,18);
 assert.equal(original.policies.length,67);
 assert.equal(original.policies.filter(p=>p.policyname==='Allow all for authenticated').length,15);
});
test('52 non-universal old policies remain even after 15 open policies disappear',()=>{
 assert.equal(original.policies.filter(p=>p.policyname!=='Allow all for authenticated').length,52);
});
test('original candidate and billing read policies give any approved account access',()=>{
 for(const [table,name] of [['candidates','read candidates'],['billing','read bill']]){
  const p=original.policies.find(x=>x.tablename===table&&x.policyname===name);
  assert.ok(p);assert.equal(p.qual,'is_approved(auth.uid())');
  assert.equal(p.cmd,'SELECT');assert.equal(p.permissive,'PERMISSIVE');
 }
});
test('replay includes all 67 original policies in source shape',()=>{
 assert.equal((replay.match(/^CREATE POLICY /gm)||[]).length,67);
 for(const p of original.policies)
  assert.ok(replay.includes('CREATE POLICY "'+p.policyname.replaceAll('"','""')+'" ON public."'+p.tablename+'"'),p.policyname);
});
test('strict 67-policy fingerprint gate precedes first security mutation',()=>{
 assert.match(migration,/count_p<>67/);
 assert.match(migration,/a70190f31ed8436b2989082898a02b51/);
 assert.ok(migration.indexOf('DO $exact_legacy$')<migration.indexOf('DO $preflight$'));
});
test('drop all 52 remaining old policies before creating new policies',()=>{
 assert.match(migration,/DO \$drop_52_remaining\$/);
 assert.match(migration,/dropped<>52/);
 assert.ok(migration.indexOf('DO $drop_52_remaining$')<migration.indexOf('CREATE POLICY profile_read'));
});
test('revised policy set contains 31 prior restrictive policies and four omitted tables',()=>{
 assert.equal((migration.match(/^CREATE POLICY /gm)||[]).length,35);
 for(const [t,p] of [
 ['app_settings','public_branding_allowlisted'],
 ['candidate_stage_history','candidate_stage_history_scoped_read'],
 ['email_log','email_log_admin_read'],
 ['workflow_rules','workflow_rules_admin_manage']
 ]) assert.ok(migration.includes('CREATE POLICY '+p+' ON public.'+t));
});
test('candidate stage history ownership is scoped to the assigned recruiter',()=>{
 assert.match(migration,/c\.assigned_recruiter=auth\.uid\(\)/);
 assert.match(migration,/candidate_stage_history_scoped_read/);
});
test('private Drive settings and candidate ownership mutation are blocked',()=>{
 assert.match(migration,/Private Drive folder exposed despite RLS/);
 assert.match(migration,/REVOKE UPDATE ON public\.candidates,public\.job_openings,public\.notifications/);
 assert.match(migration,/REVOKE INSERT,UPDATE,DELETE ON public\.user_roles,public\.profiles/);
});
test('fixture proves legacy recruiter/billing leak before fixing it',()=>{
 assert.match(fixture,/Expected legacy approved recruiter candidate exposure 2/);
 assert.match(fixture,/Expected legacy broad billing exposure 1/);
});
test('fixture detects policy drift and rolls back the negative mutation',()=>{
 assert.match(fixture,/SAVEPOINT b48_policy_drift/);
 assert.match(fixture,/ALTER POLICY "read candidates" ON public\.candidates USING \(true\)/);
 assert.match(fixture,/ROLLBACK TO SAVEPOINT b48_policy_drift/);
});
test('postflight refuses any old authorization policy or unexpected policy count',()=>{
 assert.match(migration,/IF n<>35 THEN/);
 assert.match(migration,/An old permissive authorization policy survived/);
});
test('synthetic signed role tests check two recruiters, inactive, admin and anon',()=>{
 for(const phrase of ['Recruiter A post-release cross-access','Recruiter B cross-access',
 'Inactive recruiter access','Admin candidate access missing','Anonymous candidates read'])
 assert.ok(fixture.includes(phrase),phrase);
});
test('transaction remains review-only and fully rolled back in integration test',()=>{
 assert.match(migration,/NO PRODUCTION\/STAGING DEPLOYMENT/);
 assert.match(migration,/RELEASE HOLD/);
 assert.match(fixture,/no_persistent_candidates/);
 assert.match(fixture,/ROLLBACK;/);
});

test('unsafe emergency restoration is gated to disposable rehearsal',()=>{
 const recovery=read('security/build48/unsafe-legacy-restoration-disposable-only.sql');
 const acl=JSON.parse(read('security/build48/live-acl-catalog.json'));
 const rehearsal=read('security/build48/unsafe-recovery.integration.sql');
 assert.match(recovery,/DO NOT EXECUTE IN PRODUCTION\/STAGING/);
 assert.match(recovery,/build48\.disposable_recovery/);
 assert.match(recovery,/Recovered policy fingerprint mismatch/);
 assert.equal((recovery.match(/^CREATE POLICY /gm)||[]).length,67);
 assert.equal(acl.tableAndViewGrants.length,768);
 assert.equal(acl.functionGrants.length,57);
 assert.equal(acl.schemaGrants.length,4);
 assert.match(rehearsal,/Restored pre-release broad candidate read expected 2/);
 assert.match(rehearsal,/ROLLBACK;/);
});
