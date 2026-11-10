import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrationReplayPreflight} from './migration-replay-preflight.mjs';
const migrations=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('all 26 migrations are inventoried and unattended replay is prohibited',()=>{
 const r=migrationReplayPreflight(migrations);
 assert.equal(r.status,'PREFLIGHT_ONLY_NOT_EXECUTED');
 assert.equal(r.safe_to_replay_unattended,false);
 assert.equal(r.migration_count,26);
 assert.equal(r.ordered_migrations.length,26);
 assert.ok(r.blockers.some(x=>x.type==='auth_schema_fixture_required'));
 assert.ok(r.blockers.some(x=>x.type==='security_definer_review_required'));
 assert.ok(r.blockers.some(x=>x.type==='financial_side_effect_review_required'));
 assert.deepEqual(r.ordered_migrations.map(x=>x.file),r.ordered_migrations.map(x=>x.file).sort());
});
test('incomplete or empty source cannot silently pass preflight',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-preflight-'));
 try{
  const r=migrationReplayPreflight(dir);
  assert.ok(r.blockers.some(x=>x.type==='unexpected_migration_count'));
  writeFileSync(join(dir,'20260101000000_fixture.sql'),'CREATE TABLE public.synthetic (id integer);');
  assert.equal(migrationReplayPreflight(dir).safe_to_replay_unattended,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
