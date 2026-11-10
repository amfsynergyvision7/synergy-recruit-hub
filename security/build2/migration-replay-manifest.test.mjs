import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildReplayManifest} from './migration-replay-manifest.mjs';
const directory=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('manifest is deterministic, complete and never grants replay authority',()=>{
 const a=buildReplayManifest(directory),b=buildReplayManifest(directory);
 assert.deepEqual(a,b);
 assert.equal(a.repository_migrations,26);
 assert.match(a.manifest_sha256,/^sha256:[a-f0-9]{64}$/);
 assert.equal(a.ordered_files.length,26);
 assert.equal(a.replay_authorized,false);
 assert.equal(a.schema_equivalent,false);
 assert.equal(a.release_authorized,false);
 assert.ok(a.required_reviews.length>=3);
 assert.ok(a.required_reviews.every(x=>x.reviewed===false));
 assert.ok(a.fixture_requirements.includes('financial_triggers_inactive'));
});
test('each migration is fingerprinted and uniquely ordered',()=>{
 const a=buildReplayManifest(directory);
 assert.equal(new Set(a.ordered_files.map(x=>x.file)).size,26);
 for(const file of a.ordered_files)assert.match(file.sha256,/^[a-f0-9]{64}$/);
});
