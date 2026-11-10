import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SECTIONS} from './schema-parity.mjs';

const cli=fileURLToPath(new URL('./schema-parity.mjs',import.meta.url));
function runCase(expected,actual){
 const dir=mkdtempSync(join(tmpdir(),'build2-parity-'));
 try{
  const a=join(dir,'expected.json'),b=join(dir,'actual.json');
  writeFileSync(a,JSON.stringify(expected));writeFileSync(b,JSON.stringify(actual));
  return spawnSync(process.execPath,[cli,a,b],{encoding:'utf8',timeout:10000});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const blank=()=>Object.fromEntries(SECTIONS.map(k=>[k,[]]));
test('CLI accepts complete equal synthetic metadata snapshots',()=>{
 const result=runCase(blank(),blank());
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).equal,true);
});
test('CLI fails closed on missing required section',()=>{
 const a=blank(),b=blank();delete b.indexes;
 const result=runCase(a,b);
 assert.equal(result.status,1);
 assert.ok(JSON.parse(result.stdout).findings.some(f=>f.section==='indexes'&&f.type==='missing_section'));
});
test('CLI fails closed on changed RLS policy definition',()=>{
 const a=blank(),b=blank();
 a.policies=[{schemaname:'public',tablename:'candidates',policyname:'read',qual:'false'}];
 b.policies=[{schemaname:'public',tablename:'candidates',policyname:'read',qual:'true'}];
 const result=runCase(a,b);
 assert.equal(result.status,1);
 assert.ok(JSON.parse(result.stdout).findings.some(f=>f.type==='changed_definition'&&f.section==='policies'));
});
test('CLI rejects malformed JSON without silently reporting success',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-parity-malformed-'));
 try{
  const a=join(dir,'bad.json'),b=join(dir,'good.json');
  writeFileSync(a,'{broken');writeFileSync(b,JSON.stringify(blank()));
  const result=spawnSync(process.execPath,[cli,a,b],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,1);
  assert.match(result.stderr,/SCHEMA PARITY BLOCKED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
