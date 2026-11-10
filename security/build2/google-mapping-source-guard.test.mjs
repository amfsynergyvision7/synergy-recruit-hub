import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FILE,validateMappingSource} from './google-mapping-source-guard.mjs';
const source=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('original mapping function source matches approved structural guard',()=>assert.equal(validateMappingSource(source),true));
test('privileged function and appended destructive statement fail closed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-mapping-'));
 try{
  const sql=readFileSync(join(source,FILE),'utf8');
  writeFileSync(join(dir,FILE),sql+'\nDROP TABLE public.google_integrations;');
  assert.equal(validateMappingSource(dir),false);
  writeFileSync(join(dir,FILE),sql.replace('set search_path = public','SECURITY DEFINER\nset search_path = public'));
  assert.equal(validateMappingSource(dir),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
