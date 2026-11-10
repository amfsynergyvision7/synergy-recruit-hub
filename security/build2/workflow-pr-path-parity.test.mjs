import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../../.github/workflows/security-build2-offline.yml',import.meta.url),'utf8');
const branch='security/build2-step35e-main-delta-draft-20261110';
test('disposable Build 2 workflow runs only on authorized draft branch',()=>{
 const push=workflow.match(/^  push:\n([\s\S]*?)(?=^permissions:)/m)?.[1];
 assert.ok(push,'push trigger missing');
 assert.match(push,new RegExp('^    branches:\\n      - '+branch+'$','m'));
 assert.equal((push.match(/^      - security\//gm)||[]).length,1,'unexpected extra branch');
 assert.ok(!/^  pull_request:/m.test(workflow),'PR execution must remain disabled');
 assert.ok(/^  workflow_dispatch:/m.test(workflow),'manual draft dispatch must remain possible');
 for(const job of ['application-typescript-check','offline-security-tests','isolated-postgres-view-rls']){
  const start=workflow.indexOf('  '+job+':\n');
  assert.ok(start>=0,job+' missing');
  assert.ok(workflow.slice(start,start+210).includes("github.ref == 'refs/heads/"+branch+"'"),job+' must guard branch');
 }
});
test('draft-only push retains guarded application path coverage without duplicates',()=>{
 const push=workflow.match(/^  push:\n([\s\S]*?)(?=^permissions:)/m)?.[1]??'';
 const paths=[...push.matchAll(/^      - '([^']+)'\s*$/gm)].map(x=>x[1]);
 assert.ok(paths.length>=15,'unexpectedly few guarded paths');
 assert.equal(new Set(paths).size,paths.length,'duplicate paths');
 for(const p of ['security/build2/**','src/routes/_app.bd.tsx','src/lib/bd-demo-model.ts','src/components/AppSidebar.tsx','tests/bd-*.test.mjs']){
  assert.ok(paths.includes(p),'missing guard: '+p);
 }
});
