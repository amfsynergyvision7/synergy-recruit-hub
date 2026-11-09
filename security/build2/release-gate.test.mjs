// Offline contract checks for the fail-closed security release gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('./',import.meta.url);
const evidence=JSON.parse(readFileSync(new URL('release-evidence.json',root),'utf8'));
const gate=readFileSync(new URL('release-gate.mjs',root),'utf8');
const required=[
'isolated_postgresql_rls_tests_passed',
'all_19_tables_reviewed',
'all_13_views_hardened_and_tested',
'all_16_definer_functions_reviewed',
'admin_approval_and_role_workflows_tested',
'recruiter_ownership_and_column_grants_tested',
'notifications_and_email_log_permissions_tested',
'rollback_rehearsed',
'release_approved'
];
test('every mandatory release condition is explicitly represented',()=>{
 assert.deepEqual(Object.keys(evidence).sort(),required.sort());
});
for(const key of required) test(key+' starts blocked without evidence',()=>{
 assert.deepEqual(evidence[key],{passed:false,evidence:''});
 assert.ok(gate.includes("'"+key+"'"),key);
});
test('release gate fails closed with missing evidence',()=>{
 const result=spawnSync(process.execPath,[new URL('release-gate.mjs',root).pathname],{encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/PRODUCTION RELEASE BLOCKED/);
 assert.equal((result.stdout.match(/BLOCK \|/g)||[]).length,9);
});
test('gate requires evidence string as well as passed flag',()=>{
 assert.match(gate,/entry\?\.passed===true/);
 assert.match(gate,/entry\.evidence\.trim\(\)\.length>0/);
});
