import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/routes/_app.workflow-rules.tsx',import.meta.url),'utf8');
const fixture = readFileSync(new URL('./synthetic-workflow-field-allowlist.integration.sql',import.meta.url),'utf8');
const expected = {
 candidates:['stage'],
 submissions:['status'],
 interviews:['status'],
 offers:['offer_status','joining_status'],
 billing:['payment_status'],
 clients:['status']
};
const approvedForSynthetic = {
 candidates:['stage'],submissions:['status'],interviews:['status'],offers:['offer_status']
};
test('workflow UI field choices are inventoried and uncovered pairs remain explicitly blocked',()=>{
 const section=source.match(/const TABLE_FIELDS:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
 assert.ok(section,'TABLE_FIELDS declaration not found');
 const chunks=[...section[1].matchAll(/^  (candidates|submissions|interviews|offers|billing|clients): \[([\s\S]*?)^  \],/gm)];
 assert.equal(chunks.length,6,'workflow table inventory changed');
 for(const [,table,body] of chunks){
  const found=[...body.matchAll(/value: "([a-z_]+)", label: "[^"]+", options:/g)].map(x=>x[1]);
  assert.deepEqual(found,expected[table],table+' UI field inventory changed: review security policy');
  for(const field of found){
   const inAllowlist=fixture.includes("('"+table+"','"+field+"')");
   assert.equal(inAllowlist,(approvedForSynthetic[table]??[]).includes(field),
     table+'.'+field+' allowlist changed without compatibility review');
  }
 }
});
