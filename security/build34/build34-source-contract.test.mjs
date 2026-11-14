import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isApprovedActiveWithRole } from '../../src/lib/approved-role-policy.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const file=(p)=>readFileSync(resolve(root,p),'utf8');
for(const [name,profile,roles,allowed,expected] of [
 ['approved admin',{status:'approved',is_active:true},[{role:'admin'}],['admin'],true],
 ['pending admin',{status:'pending',is_active:true},[{role:'admin'}],['admin'],false],
 ['inactive admin',{status:'approved',is_active:false},[{role:'admin'}],['admin'],false],
 ['rejected admin',{status:'rejected',is_active:true},[{role:'admin'}],['admin'],false],
 ['no profile',null,[{role:'admin'}],['admin'],false],
 ['no roles',{status:'approved',is_active:true},null,['admin'],false],
 ['recruiter may not administer',{status:'approved',is_active:true},[{role:'recruiter'}],['admin'],false],
 ['recruiter candidate AI',{status:'approved',is_active:true},[{role:'recruiter'}],['admin','recruiter'],true],
]) {
 test('source role policy: '+name,()=>assert.equal(isApprovedActiveWithRole(profile,roles,allowed),expected));
}
test('application cron handler authenticates then binds the owner',()=>{
 const s=file('src/routes/api/public/hooks/sheets-sync.ts');
 assert.match(s,/handleCandidateSyncCron\(request/);
 assert.match(s,/process\.env\.CRON_SECRET/);
 assert.match(s,/userId: ownerId/);
 assert.match(s,/GET: handler, POST: handler/);
});
test('server-side role gate checks profile and role data',()=>{
 const s=file('src/lib/access-gates.server.ts');
 assert.match(s,/\.from\('profiles'\)\.select\('status,is_active'\)/);
 assert.match(s,/\.from\('user_roles'\)\.select\('role'\)/);
 assert.doesNotMatch(s,/user_metadata|raw_user_meta_data/);
});
test('all six sensitive AI/import handlers retain server-side role guards',()=>{
 const s=file('src/lib/ai.functions.ts');
 assert.equal((s.match(/await assertApprovedRole\(context\.userId,/g)||[]).length,6);
});
