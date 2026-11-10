import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {FILE,validateInterviewSchedulingSource} from './interview-scheduling-source-guard.mjs';
const source=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('original interview scheduling SQL matches exact allowlist',()=>assert.equal(validateInterviewSchedulingSource(source),true));
test('altered index and extra SQL fail closed',()=>{
 const temp=mkdtempSync(join(tmpdir(),'build2-scheduling-'));
 try{
  const sql=readFileSync(join(source,FILE),'utf8');
  writeFileSync(join(temp,FILE),sql+'\nDROP TABLE public.interviews;');
  assert.equal(validateInterviewSchedulingSource(temp),false);
  writeFileSync(join(temp,FILE),sql.replace('CREATE UNIQUE INDEX','CREATE INDEX'));
  assert.equal(validateInterviewSchedulingSource(temp),false);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
