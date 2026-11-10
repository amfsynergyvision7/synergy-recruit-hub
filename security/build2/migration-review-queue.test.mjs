import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {migrationReviewQueue} from './migration-review-queue.mjs';
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
const dir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('the one blocked original extension migration remains in one review batch',()=>{
 const q=migrationReviewQueue(dir);
 assert.equal(q.total,26);assert.equal(q.rehearsed,25);assert.equal(q.blocked,1);
 assert.equal(q.batch_count,1);
 const files=q.batches.flatMap(x=>x.files);
 assert.equal(files.length,1);
 assert.equal(new Set(files.map(x=>x.file)).size,1);
 assert.ok(files.every(x=>x.original_sql_execution_authorized===false));
 assert.equal(q.production_release,'HOLD');
});
test('review queue is deterministic; historical financial risks remain inventoried',()=>{
 const a=migrationReviewQueue(dir);
 assert.deepEqual(a,migrationReviewQueue(dir));
 assert.ok(a.batches.some(x=>x.files.some(f=>f.reasons.includes('extension_dependency'))));
 assert.ok(bulkMigrationTriage(dir).items.some(x=>x.reasons.includes('financial_workflow_review')));
});
