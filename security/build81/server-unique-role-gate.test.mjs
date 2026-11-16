import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isApprovedActiveWithRole} from '../../src/lib/approved-role-policy.ts';

const approved={status:'approved',is_active:true};
const permitted=['admin','recruiter'];
const cases=[
 ['single active admin',approved,[{role:'admin'}],true],
 ['single active recruiter',approved,[{role:'recruiter'}],true],
 ['single finance disallowed for admin/recruiter',approved,[{role:'finance'}],false],
 ['duplicate admin memberships',approved,[{role:'admin'},{role:'admin'}],false],
 ['conflicting admin and viewer',approved,[{role:'admin'},{role:'viewer'}],false],
 ['conflicting recruiter and finance',approved,[{role:'recruiter'},{role:'finance'}],false],
 ['two disallowed memberships',approved,[{role:'viewer'},{role:'finance'}],false],
 ['malformed role row',approved,[{role:undefined}],false],
 ['empty role row list',approved,[],false],
 ['null roles',approved,null,false],
 ['pending admin',{status:'pending',is_active:true},[{role:'admin'}],false],
 ['inactive admin',{status:'approved',is_active:false},[{role:'admin'}],false],
 ['missing profile',null,[{role:'admin'}],false],
 ['missing allowlist',approved,[{role:'admin'}],false],
];
for(const [name,profile,rows,allow] of cases) {
 test('Build81 server-role gate: '+name,()=>{
  assert.equal(isApprovedActiveWithRole(profile,rows,name==='missing allowlist'?[]:permitted),allow);
 });
}

test('Build81 server role semantics match Build80 exactly-one-role SECURITY DEFINER rule',()=>{
 const sql=readFileSync(new URL('../build80/15-surface-135-read-review-only.rollback.sql',import.meta.url),'utf8');
 const ts=readFileSync(new URL('../../src/lib/approved-role-policy.ts',import.meta.url),'utf8');
 assert.match(sql,/count\(\*\)=1 AND bool_and\(ur.role=wanted\)/);
 assert.match(ts,/memberships.length !== 1/);
 assert.doesNotMatch(ts,/memberships\.some\(/);
});
test('Build81 admin service-role gate retains signed-user approved and active checks',()=>{
 const gate=readFileSync(new URL('../../src/lib/access-gates.server.ts',import.meta.url),'utf8');
 assert.match(gate,/isApprovedActiveWithRole\(profile, roles, allowed\)/);
 assert.match(gate,/\.from\('profiles'\)\.select\('status,is_active'\)/);
 assert.match(gate,/\.from\('user_roles'\)\.select\('role'\)/);
 assert.doesNotMatch(gate,/user_metadata|raw_user_meta_data|session\.user_metadata/);
});
