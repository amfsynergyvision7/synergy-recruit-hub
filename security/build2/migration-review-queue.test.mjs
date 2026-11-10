import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {migrationReviewQueue} from './migration-review-queue.mjs';
const dir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('all 6 blocked original migrations are assigned exactly once to six review batches',()=>{
 const q=migrationReviewQueue(dir);
 assert.equal(q.total,26);assert.equal(q.rehearsed,20);assert.equal(q.blocked,6);
 assert.equal(q.batch_count,6);
 const files=q.batches.flatMap(x=>x.files);
 assert.equal(files.length,6);
 assert.equal(new Set(files.map(x=>x.file)).size,6);
 assert.ok(files.every(x=>x.original_sql_execution_authorized===false));
 assert.equal(q.production_release,'HOLD');
});
test('review queue is deterministic and retains extension and financial risk reasons',()=>{
 const a=migrationReviewQueue(dir);
 assert.deepEqual(a,migrationReviewQueue(dir));
 assert.ok(a.batches.some(x=>x.files.some(f=>f.reasons.includes('extension_dependency'))));
 assert.ok(a.batches.some(x=>x.files.some(f=>f.reasons.includes('financial_workflow_review'))));
});
