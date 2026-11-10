import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSafeColumnMigrations} from './safe-column-migration-guard.mjs';
const source=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
const names=['20260927180000_job_requirements_field.sql','20260927200000_candidate_resume_summary.sql','20260930100000_candidate_ats_score.sql'];
test('actual three migration files contain only five allowlisted additive statements',()=>{
 const r=validateSafeColumnMigrations(source);
 assert.equal(r.safe,true,JSON.stringify(r.issues));
 assert.equal(r.files,3);assert.equal(r.columns.length,5);
});
test('unexpected destructive statement fails closed before database execution',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-column-guard-'));
 try{
  for(const name of names)writeFileSync(join(dir,name),readFileSync(join(source,name),'utf8'));
  assert.equal(validateSafeColumnMigrations(dir).safe,true);
  writeFileSync(join(dir,names[0]),readFileSync(join(dir,names[0]),'utf8')+'\nDROP TABLE public.candidates;\n');
  assert.equal(validateSafeColumnMigrations(dir).safe,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('missing file and changed column definition fail closed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-column-guard-'));
 try{
  for(const name of names)writeFileSync(join(dir,name),readFileSync(join(source,name),'utf8'));
  rmSync(join(dir,names[1]));
  assert.equal(validateSafeColumnMigrations(dir).safe,false);
  writeFileSync(join(dir,names[1]),'ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS resume_summary JSONB;');
  assert.equal(validateSafeColumnMigrations(dir).safe,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
