import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FILE,validateCandidateDefaultsTrigger} from './candidate-defaults-trigger-source-guard.mjs';
test('reviewed original source passes strict guard',()=>{
 assert.equal(validateCandidateDefaultsTrigger(fileURLToPath(new URL('../../supabase/migrations/',import.meta.url))),true);
});
test('changed or missing trigger source is blocked',()=>{
 const d=mkdtempSync(join(tmpdir(),'build2-trigger-'));
 try{
  assert.equal(validateCandidateDefaultsTrigger(d),false);
  for(const sql of ['DROP TABLE public.candidates;','create trigger set_candidate_sync_defaults_trigger before update on public.candidates for each row execute function public.set_candidate_sync_defaults();']){
   writeFileSync(join(d,FILE),sql);assert.equal(validateCandidateDefaultsTrigger(d),false);
  }
 }finally{rmSync(d,{recursive:true,force:true});}
});
