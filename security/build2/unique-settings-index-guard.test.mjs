import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {INDEX_MIGRATION,validateIndexMigration} from './unique-settings-index-guard.mjs';
const dir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('original unique settings index matches pinned SQL',()=>assert.equal(validateIndexMigration(dir),true));
test('index changes and appended destructive SQL fail closed',()=>{
 const temp=mkdtempSync(join(tmpdir(),'build2-index-'));
 try{
  const original=readFileSync(join(dir,INDEX_MIGRATION),'utf8');
  writeFileSync(join(temp,INDEX_MIGRATION),original+'\nDROP TABLE public.google_integrations;');
  assert.equal(validateIndexMigration(temp),false);
  writeFileSync(join(temp,INDEX_MIGRATION),original.replace(/unique index/i,'index'));
  assert.equal(validateIndexMigration(temp),false);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
