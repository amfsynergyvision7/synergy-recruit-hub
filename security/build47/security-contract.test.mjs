import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const inventory=JSON.parse(read('security/build47/catalog-inventory.json'));
const migration=read('security/build47/48-object-lockdown-review-only.sql');
const acl=read('security/build47/48-object-lockdown.integration.sql');
const integrated=read('security/build47/48-object-and-rls.integration.sql');
const documentation=read('security/build47/README.md');

test('exact 48-object inventory: 19 tables, 13 views, 16 functions and 15 broad policies',()=>{
 const v=inventory.objects;
 assert.equal(v.tables.length,19);assert.equal(v.views.length,13);
 assert.equal(v.functions.length,16);assert.equal(v.unrestricted_policies.length,15);
 assert.equal(new Set([...v.tables,...v.views,...v.functions]).size,48);
});
test('all 48 named objects have draft catalog coverage',()=>{
 for(const name of [...inventory.objects.tables,...inventory.objects.views,...inventory.objects.functions])
   assert.ok(migration.includes("'"+name+"'"),name);
});
test('catalog preflight checks object counts and precedes every mutation',()=>{
 for(const count of [19,13,16,15])assert.ok(migration.includes('n<>'+count));
 assert.ok(migration.indexOf('DO $preflight$')<migration.indexOf('DO $broad$'));
 assert.match(migration,/48-object baseline drift/);
});
test('drift negative test first changes a view and then forces rollback',()=>{
 assert.match(acl,/SAVEPOINT b47_catalog_drift/);
 assert.match(acl,/Preflight accepted drifted view configuration/);
 assert.match(acl,/ROLLBACK TO SAVEPOINT b47_catalog_drift/);
});
test('drops fifteen universal RLS policies instead of adding an ineffective OR policy',()=>{
 assert.match(migration,/DROP POLICY %I ON public.%I/);
 assert.match(migration,/Universal RLS policies remain/);
});
test('closes anonymous table grants including TRUNCATE and CREATE-on-public',()=>{
 assert.match(migration,/REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon/);
 assert.match(migration,/REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN/);
 assert.match(migration,/REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated/);
});
test('public branding is limited to three columns and private folder is denied',()=>{
 assert.match(migration,/GRANT SELECT\(id,logo_url,default_color_theme\)/);
 assert.match(migration,/Anonymous Drive folder settings exposed/);
 assert.match(migration,/Public branding compatibility broken/);
});
test('thirteen views become security invoker and lose anonymous selection',()=>{
 assert.match(migration,/ALTER VIEW public.%I SET \(security_invoker=true\)/);
 assert.match(migration,/Unhardened or exposed views remain/);
});
test('all privileged function grants lose PUBLIC and anonymous access',()=>{
 assert.match(migration,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION %s TO service_role/);
 assert.match(migration,/Anonymous privileged EXECUTE remains/);
});
test('three authenticated role helpers are preserved and sensitive RPC execution denied',()=>{
 assert.match(migration,/get_user_role','has_role','is_approved/);
 assert.match(acl,/Authenticated RLS helper regression/);
 assert.match(acl,/Authenticated caller still executes sensitive RPC/);
});
test('source-shaped catalog fixture defines nineteen tables, thirteen views and sixteen stubs',()=>{
 assert.equal((acl.match(/CREATE TABLE public\./g)||[]).length,19);
 assert.equal((acl.match(/CREATE VIEW public\./g)||[]).length,13);
 assert.equal((acl.match(/CREATE FUNCTION public\./g)||[]).length,16);
 assert.equal((acl.match(/CREATE POLICY "Allow all for authenticated"/g)||[]).length,15);
});
test('actual anonymous role enforcement and transaction rollback are included',()=>{
 assert.match(acl,/SET ROLE anon/);
 assert.match(acl,/Anonymous role RPC succeeded/);
 assert.match(acl,/Anonymous private table read succeeded/);
 assert.match(acl,/no_persistent_candidate_table/);
 assert.match(acl,/ROLLBACK;/);
});
test('integrated fixture checks exact thirty-one restrictive RLS policies',()=>{
 assert.equal((integrated.match(/CREATE POLICY profile_read/g)||[]).length,1);
 assert.equal((integrated.match(/CREATE POLICY candidates_read/g)||[]).length,1);
 assert.equal((integrated.match(/CREATE POLICY (?!"Allow all for authenticated")/g)||[]).length,31);
 assert.match(integrated,/Expected 31 restrictive policies/);
});
test('integrated fixture checks recruiter A/B, inactive user and admin segregation',()=>{
 for(const phrase of ['Recruiter A read','Recruiter B read','Inactive recruiter accessed','Admin lost access'])
   assert.ok(integrated.includes(phrase));
 assert.match(integrated,/Recruiter assignment update privilege remained/);
 assert.match(integrated,/Recruiter self-promotion succeeded/);
});
test('review SQL is not under active migrations and release counters stay at zero',()=>{
 assert.match(migration,/DO NOT RUN in production\/staging/);
 assert.match(documentation,/RELEASE HOLD/);
 assert.equal(inventory.release.production_security_remediated,0);
 assert.equal(inventory.release.hosted_authorization_accepted,0);
 assert.equal(inventory.release.formal_gates_passed,0);
 assert.ok(readdirSync('supabase/migrations').every(x=>!x.includes('build47')));
});
