import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const server=read('src/lib/integrations.functions.ts');
const importer=read('src/lib/sheets-sync.server.ts');
const drive=read('src/lib/drive-import.server.ts');
const ai=read('src/lib/ai.functions.ts');
const ux=read('src/routes/_app.integrations.tsx');
const driveButton=read('src/components/DriveImportButton.tsx');
const sql=read('security/build44/production-trigger-compat.integration.sql');

test('manual new-row sync uses the exact same transactional lease RPC as scheduled sync',()=>{
 assert.match(server,/withCandidateSyncLease\(\s*context\.userId/);
 assert.match(server,/\(heartbeat, token\) => runCandidateSync\(\{/);
 assert.match(server,/leaseHeartbeat: heartbeat, leaseToken: token, atomicRowWrites: true/);
 assert.match(server,/createSupabaseSyncLeaseOperations\(supabaseAdmin as any\)/);
});
test('manual full-history cannot rewind cursor without idempotency reconciliation',()=>{
 assert.match(server,/if \(data\.fullHistory\) \{\s*throw new Error\("Full-history resync is paused/);
 assert.doesNotMatch(server,/resetGoogleIntegrationSyncCursor\(/);
 assert.match(importer,/Sync cursor reset is disabled pending safe ledger reconciliation/);
});
test('public candidate sync rejects legacy multi-write calls before any work',()=>{
 const start=importer.indexOf('export async function runCandidateSync(');
 const guard=importer.indexOf('Non-atomic candidate sync disabled',start);
 const execute=importer.indexOf('return await runCandidateSyncUnsafe(opts)',start);
 assert.ok(start>0&&guard>start&&guard<execute,'mandatory atomic gate must precede import execution');
 assert.match(importer,/if \(!opts\.atomicRowWrites \|\| !opts\.leaseToken \|\| !opts\.leaseHeartbeat\)/);
 assert.match(importer,/if \(opts\.fullHistory\) throw new Error/);
});
test('manual UI disables misleading full history action',()=>{
 assert.match(ux,/<Button variant="outline" disabled title="Full-history import requires reconciliation/);
 assert.match(ux,/Full history \(paused\)/);
 assert.doesNotMatch(ux,/syncMut\.mutate\(true\)/);
});
test('Drive importer fails closed before any integration credentials or network access',()=>{
 const guard=drive.indexOf('assertDriveBulkImportReviewed();');
 const api=drive.indexOf('const apiKey = process.env.DRIVE_API_KEY');
 assert.ok(guard>0&&guard<api,'Drive hold must precede provider access');
 assert.match(drive,/function assertDriveBulkImportReviewed\(\): void \{\s*throw new Error/);
 assert.match(ai,/await assertApprovedRole\(context\.userId, \["admin"\]\);\s*return runResumeDriveImport\(context\.supabase\)/);
});
test('Drive UI communicates pause and has no enabled import controls',()=>{
 assert.match(driveButton,/disabled\s+title="Drive bulk import is paused until transactional deduplication is approved"/);
 assert.match(driveButton,/>Drive bulk import paused<\/span>/);
 assert.match(driveButton,/title="Drive bulk import is paused until approved"/);
 assert.doesNotMatch(driveButton,/onClick=\{\(\) => \{ setOpen\(true\); mut\.mutate\(\); \}\}/);
});
test('source-equivalent PostgreSQL fixture includes seven real function definitions',()=>{
 const names=['on_candidate_stage_change','run_workflow_rules','set_assigned_recruiter','set_candidate_sync_defaults','set_updated_at','sync_google_integration_mapping','track_stage_changes'];
 for(const fn of names)assert.ok(sql.includes('FUNCTION public.'+fn+'()'),fn);
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length,7);
});
test('source-equivalent fixture attaches all nine production candidate/integration triggers',()=>{
 for(const trigger of ['candidates_sync_defaults_trigger','set_candidate_sync_defaults_trigger','set_assigned_recruiter_trigger','candidates_updated_at_trigger','track_stage_changes_trigger','trg_candidate_stage_change','workflow_rules_trigger','set_google_integrations_updated_at','sync_google_integration_mapping_trigger'])
  assert.ok(sql.includes('CREATE TRIGGER '+trigger),trigger);
 assert.equal((sql.match(/CREATE TRIGGER [a-z_]+/g)||[]).length,9);
});
test('synthetic trigger rehearsal preserves explicit approved recruiter assignment',()=>{
 assert.match(sql,/explicit approved recruiter assignment not preserved by actual trigger/);
 assert.match(sql,/stage history trigger expected 1/);
 assert.match(sql,/ROLLBACK;/);
});
test('the new SQL remains CI-only, not a live database migration',()=>{
 assert.ok(!sql.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.match(sql,/not a deployable migration/i);
});

test('Build45 manual sync requires explicit release flag and propagates row errors',()=>{
 assert.match(server,/CANDIDATE_SYNC_MANUAL_ENABLED !== "true"/);
 assert.match(server,/if \(execution\.value\.errors !== 0\)/);
 assert.match(server,/review the sync log/);
 assert.match(ux,/Sync new rows \(paused\)/);
 assert.doesNotMatch(ux,/syncMut\.mutate\(false\)/);
});
