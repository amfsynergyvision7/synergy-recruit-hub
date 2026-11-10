import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f.sql','utf8');
// Negative release checks: this migration remains blocked until ambiguity and privilege risks are resolved.
test('original relationship backfill includes nondeterministic multi-match updates',()=>{
 assert.match(sql,/UPDATE public\.interviews i\s+SET submission_uuid = s\.id\s+FROM public\.submissions s/i);
 assert.match(sql,/UPDATE public\.offers o\s+SET interview_uuid = i\.id\s+FROM public\.interviews i/i);
 assert.match(sql,/UPDATE public\.billing b\s+SET offer_uuid = o\.id\s+FROM public\.offers o/i);
});
test('original relationship migration contains SECURITY DEFINER resolvers requiring explicit review',()=>{
 for(const name of ['resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid']){
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\('));
 }
 assert.ok((sql.match(/SECURITY DEFINER/gi)||[]).length>=3);
});
test('relationship migration is not promoted by risk tests alone',()=>{
 const queue=readFileSync('security/build2/migration-review-queue.mjs','utf8');
 assert.match(queue,/relationship_backfill.*20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f\.sql/);
});
