import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
const directory=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('all 26 source migrations are deterministically classified in one batch',()=>{
 const a=bulkMigrationTriage(directory),b=bulkMigrationTriage(directory);
 assert.deepEqual(a,b);
 assert.equal(a.total,26);assert.equal(a.subset_candidates,25);assert.equal(a.remaining,1);
 assert.equal(a.items.length,26);assert.equal(new Set(a.items.map(x=>x.file)).size,26);
 assert.ok(a.items.every(x=>x.unattended_full_replay_authorized===false));
 assert.equal(a.all_26_replay_verified,false);assert.equal(a.source_equivalence_verified,false);
});
test('review queue preserves extension, storage and financial blockers',()=>{
 const a=bulkMigrationTriage(directory);
 assert.ok(a.items.some(x=>x.reasons.includes('extension_dependency')));
 assert.ok(a.items.some(x=>x.reasons.includes('storage_dependency')));
 assert.ok(a.items.some(x=>x.reasons.includes('financial_workflow_review')));
 assert.ok(a.items.filter(x=>!x.subset_rehearsed).every(x=>x.classification==='manual_dependency_review_required'));
});
