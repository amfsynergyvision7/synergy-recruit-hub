import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertExternalEffectReleased,isExternalEffectPaused} from '../../src/lib/external-effects-hold.server.ts';

const file=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const guard=file('src/lib/external-effects-hold.server.ts');
const integrations=file('src/lib/integrations.functions.ts');
const sheets=file('src/lib/sheets-sync.server.ts');
const cron=file('src/routes/api/public/hooks/sheets-sync.ts');
const dupes=file('src/lib/duplicates.functions.ts');

test('Build83 eight server release controls remain hard-code true with zero environment bypass',()=>{
 assert.equal((guard.match(/RELEASE_HOLD = true as const;/g)||[]).length,8);
 assert.doesNotMatch(guard,/process\.env|import\.meta\.env|localStorage/);
 for(const name of ['candidate_sync','integration_configuration']){
  assert.equal(isExternalEffectPaused(name),true);
  assert.throws(()=>assertExternalEffectReleased(name),/paused pending release approval/);
 }
});
test('manual candidate sync refuses release before admin check, env flag or service-role lease',()=>{
 const start=integrations.indexOf('export const triggerSync');
 const end=integrations.indexOf('export const getSyncLogs',start);
 const code=integrations.slice(start,end);
 const hold=code.indexOf('assertExternalEffectReleased("candidate_sync")');
 const admin=code.indexOf('await assertAdminUser(context.userId)');
 const env=code.indexOf('process.env.CANDIDATE_SYNC_MANUAL_ENABLED');
 const lease=code.indexOf('withCandidateSyncLease(');
 assert(hold>0&&hold<admin&&admin<env&&env<lease);
});
test('scheduled candidate sync release hold defeats environment enabled option before cron dependencies',()=>{
 const hold=cron.indexOf("isExternalEffectPaused('candidate_sync')");
 const enabled=cron.indexOf('process.env.SHEETS_SYNC_CRON_ENABLED');
 const run=cron.indexOf('runCandidateSync({');
 assert(hold>0&&enabled>hold&&run>enabled);
 assert(cron.includes('enabled: isExternalEffectPaused'));
 assert(cron.includes('getSavedGoogleIntegration({ backfillLegacy: false'));
});
test('direct low-level candidate sync cannot run with service-role even if cron/manual handler is bypassed',()=>{
 const start=sheets.indexOf('export async function runCandidateSync(');
 const end=sheets.indexOf('export async function fetchHeaders(',start);
 const code=sheets.slice(start,end);
 const hold=code.indexOf('assertExternalEffectReleased("candidate_sync")');
 const sync=code.indexOf('return await runCandidateSyncUnsafe(opts)');
 assert(hold>0&&sync>hold);
 assert(code.includes('Full-history sync disabled'));
 assert(code.includes('Non-atomic candidate sync disabled'));
});
test('integration GET is read-only and disables implicit legacy backfill by default',()=>{
 const read=integrations.slice(integrations.indexOf('export const getIntegration'),integrations.indexOf('export const saveIntegration'));
 assert(read.includes('getSavedGoogleIntegration({ backfillLegacy: false, userId: context.userId })'));
 const start=sheets.indexOf('export async function getSavedGoogleIntegration(');
 const end=sheets.indexOf('export async function saveGoogleIntegrationSettings(',start);
 const code=sheets.slice(start,end);
 const conditional=code.indexOf('if (opts.backfillLegacy !== true) return null;');
 const hold=code.indexOf('assertExternalEffectReleased("integration_configuration")');
 const write=code.indexOf('.upsert(payload,');
 assert(conditional>0&&hold>conditional&&write>hold);
});
test('integration save and header detection refuse before admin, network or write',()=>{
 const save=integrations.slice(integrations.indexOf('export const saveIntegration'),integrations.indexOf('export const detectHeaders'));
 const detect=integrations.slice(integrations.indexOf('export const detectHeaders'),integrations.indexOf('export const triggerSync'));
 for(const s of [save,detect]){
  const hold=s.indexOf('assertExternalEffectReleased("integration_configuration")');
  const admin=s.indexOf('await assertAdminUser(context.userId)');
  assert(hold>0&&admin>hold);
 }
 assert(detect.indexOf('fetchSheetValues(')>detect.indexOf('assertExternalEffectReleased'));
});
test('low-level integration configuration writes and external sheet fetch require release',()=>{
 const save=sheets.slice(sheets.indexOf('export async function saveGoogleIntegrationSettings('),sheets.indexOf('export async function saveDetectedHeaders('));
 const headers=sheets.slice(sheets.indexOf('export async function saveDetectedHeaders('),sheets.indexOf('export async function resetGoogleIntegrationSyncCursor('));
 const fetch=sheets.slice(sheets.indexOf('export async function fetchSheetValues('),sheets.indexOf('export async function runCandidateSyncUnsafe(')>0?sheets.indexOf('export async function runCandidateSyncUnsafe('):sheets.length);
 assert(save.indexOf('assertExternalEffectReleased("integration_configuration")')>0);
 assert(save.indexOf('assertExternalEffectReleased("integration_configuration")')<save.indexOf('getSavedGoogleIntegration('));
 assert(headers.indexOf('assertExternalEffectReleased("integration_configuration")')>0);
 assert(headers.indexOf('assertExternalEffectReleased("integration_configuration")')<headers.indexOf('.from("google_integrations")'));
 assert(fetch.indexOf('assertExternalEffectReleased("integration_configuration")')>0);
 assert(fetch.indexOf('assertExternalEffectReleased("integration_configuration")')<fetch.indexOf('gw('));
});
test('failed sync diagnostics no longer propagate raw provider exception into CRM logs',()=>{
 const start=sheets.indexOf('export async function runCandidateSync(');
 const end=sheets.indexOf('export async function fetchHeaders(',start);
 const sync=sheets.slice(start,end);
 assert(sync.includes('const message = "Candidate sync failed; review restricted server diagnostics";'));
 assert(!sync.includes('e?.message || String(e)'));
 assert(!sync.includes('console.error("Failed to write sync failure log", logError)'));
});
test('duplicate-candidate full contact scan requires unique active admin before reading any candidate',()=>{
 assert(dupes.includes('.middleware([requireSupabaseAuth])'));
 const admin=dupes.indexOf('await assertApprovedRole(context.userId, ["admin"])');
 const query=dupes.indexOf('return findDuplicateClusters(context.supabase, context.userId)');
 assert(admin>0&&query>admin);
 assert(!dupes.includes('no extra role gate'));
});
