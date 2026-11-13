import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertExternalEffectReleased,isExternalEffectPaused} from '../../src/lib/external-effects-hold.server.ts';
import {redactSyncErrors,sanitizeStoredSyncLogs,SAFE_CANDIDATE_SYNC_ERROR,redactHistoricalIntegrationError} from '../../src/lib/sync-safety.ts';

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
test('ownerless legacy Sheets configuration cannot silently backfill into a new signed-in admin account',()=>{
 const read=integrations.slice(integrations.indexOf('export const getIntegration'),integrations.indexOf('export const saveIntegration'));
 assert(read.includes('getSavedGoogleIntegration({ backfillLegacy: false, userId: context.userId })'));
 const start=sheets.indexOf('export async function getSavedGoogleIntegration(');
 const end=sheets.indexOf('export async function saveGoogleIntegrationSettings(',start);
 const code=sheets.slice(start,end);
 assert(code.includes('if (!opts.userId) throw new Error("Explicit integration owner required")'));
 assert(code.includes('.eq("user_id", opts.userId)'));
 assert(code.includes('if (data) return redactHistoricalIntegrationError({...(data as GoogleIntegrationSettings),last_error:null})'));
 assert(!code.includes('if (data) return data as GoogleIntegrationSettings'));
 assert(code.includes('if (opts.backfillLegacy === true)'));
 assert(code.includes('Legacy Sheets integration requires independently reviewed owner mapping'));
 assert(code.includes('return null;'));
 assert(!code.includes('.from("integrations")'));
 assert(!code.includes('.upsert('));
 assert(!code.includes('legacy.sheet_url'));
 const save=sheets.slice(sheets.indexOf('export async function saveGoogleIntegrationSettings('),
  sheets.indexOf('export async function saveDetectedHeaders('));
 assert(save.includes('getSavedGoogleIntegration({ backfillLegacy: false, userId: input.user_id })'));
 assert(!save.includes('backfillLegacy: true'));
 assert(save.includes('assertExternalEffectReleased("integration_configuration")'));
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
 assert(sync.includes('const message = SAFE_CANDIDATE_SYNC_ERROR;'));
 assert(sheets.includes('message: SAFE_CANDIDATE_SYNC_ERROR });'));
 assert(sheets.includes('return sanitizeStoredSyncLogs(data ?? []);'));
 assert(!sheets.includes('message: e?.message || String(e)'));
 assert(!sheets.includes('const parts = [error?.message, error?.details, error?.hint, error?.code]'));
 const headers=sheets.slice(sheets.indexOf('export async function saveDetectedHeaders('),sheets.indexOf('export async function resetGoogleIntegrationSyncCursor('));
 assert(headers.includes('if (error) throw new Error('));
 assert(!headers.includes('if (error) throw error;'));
 assert(sheets.includes('const message = SAFE_CANDIDATE_SYNC_ERROR;'));
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

test('Build96 legacy Sheets ownership cannot be inferred from the service-role or an HTTP session',()=>{
 const src=file('src/lib/sheets-sync.server.ts');
 const integrationRead=src.slice(src.indexOf('export async function getSavedGoogleIntegration('),
   src.indexOf('export async function saveGoogleIntegrationSettings('));
 const save=src.slice(src.indexOf('export async function saveGoogleIntegrationSettings('),
   src.indexOf('export async function saveDetectedHeaders('));
 // No cross-account global table read or implicit source->owner transfer.
 assert(!integrationRead.includes('.from("integrations")'));
 assert(!integrationRead.includes('auto_sync_enabled: !!legacy.auto_sync'));
 assert(!integrationRead.includes('.upsert(payload'));
 assert(save.includes('user_id: input.user_id'));
 assert(save.includes('.eq("user_id", input.user_id)'));
 const routes=file('src/lib/integrations.functions.ts');
 const h=routes.slice(routes.indexOf('export const saveIntegration'),routes.indexOf('export const detectHeaders'));
 assert(h.includes('await assertAdminUser(context.userId)'));
 assert(h.includes('user_id: context.userId'));
 assert(h.indexOf('await assertAdminUser(context.userId)')<h.indexOf('saveGoogleIntegrationSettings('));
});

test('Build97 provider exceptions and historical sync logs cannot expose candidate PII, URLs or credentials',()=>{
 const secret='Bearer PRIVATE_TOKEN_CANDIDATE_ALICE';
 const email='candidate.alice@employer.example';
 const sheet='https://docs.google.com/spreadsheets/d/private-sheet-123/edit';
 const raw={id:'01234567-89ab-cdef-0123-456789abcdef',module:'candidates',
  triggered_by:'manual',rows_scanned:7,rows_created:2,rows_updated:1,rows_skipped:4,
  status:'error',message:'Internal exception for '+email,last_error:secret,
  errors:[{row:3,message:email+' '+secret+' '+sheet},
   {row:4,message:sheet}],
  sheet_url:sheet,user_id:'owner-private',
  created_at:'2026-11-13T10:00:00.000Z'};
 const sanitized=sanitizeStoredSyncLogs([raw]);
 assert.equal(sanitized.length,1);
 assert.equal(sanitized[0].module,'candidates');
 assert.equal(sanitized[0].rows_created,2);
 assert.equal(sanitized[0].status,'error');
 assert.deepEqual(sanitized[0].errors,[
  {row:3,message:SAFE_CANDIDATE_SYNC_ERROR},
  {row:4,message:SAFE_CANDIDATE_SYNC_ERROR}]);
 const rendered=JSON.stringify(sanitized);
 for(const secretText of [secret,email,sheet,'owner-private','private-sheet-123'])
  assert(!rendered.includes(secretText),'Sensitive data escaped redaction');
 assert.deepEqual(redactSyncErrors(null),[]);
 assert.deepEqual(redactSyncErrors([{row:-1,message:email}]),
  [{row:0,message:SAFE_CANDIDATE_SYNC_ERROR}]);
 assert.throws(()=>redactSyncErrors(Array(1001).fill({row:1,message:secret})),/restricted review/);
 assert.throws(()=>sanitizeStoredSyncLogs([{errors:Array(1001).fill({row:1})}]),/restricted review/);
 assert.throws(()=>sanitizeStoredSyncLogs({error:secret}),/readback unavailable/);
 assert.throws(()=>sanitizeStoredSyncLogs([null]),/readback malformed/);
});
test('Build97 unsafe legacy sync error and browser console paths no longer leak account data',()=>{
 const src=file('src/lib/sheets-sync.server.ts');
 const unsafe=src.slice(src.indexOf('async function runCandidateSyncUnsafe('),
   src.indexOf('export async function runCandidateSync('));
 assert(unsafe.includes('message: SAFE_CANDIDATE_SYNC_ERROR'));
 assert(!unsafe.includes('result.error_details.push({ row: sheetRowNumber, message: e?.message'));
 assert(unsafe.includes('last_error: result.error_details.length ? result.error_details[0].message : null'));
 const logRead=src.slice(src.indexOf('export async function getCandidateSyncLogs()'),
   src.indexOf('export async function fetchSheetValues('));
 assert(logRead.includes('return sanitizeStoredSyncLogs(data ?? []);'));
 assert(logRead.includes('if (error) throw new Error("Sync log retrieval unavailable")'));
 const format=src.slice(src.indexOf('function formatSupabaseError('),
   src.indexOf('export interface SyncDiagnostics'));
 assert(!format.includes('error?.message'));
 assert(!format.includes('error?.details'));
 assert(!format.includes('error?.hint'));
 const ui=file('src/routes/_app.integrations.tsx');
 assert(!ui.includes('console.info("Google integration save success"'));
 assert(!ui.includes('console.error("Google integration save error", e)'));
 assert(!ui.includes('console.error("Google integration save failed", row)'));
 assert(!ui.includes('toast.error(e?.message'));
 assert(!ui.includes('row.integration.sheet_url, diagnostics: row.diagnostics'));
});

test('Build99 legacy integration errors cannot cross the owner-scoped settings readback',()=>{
 const privateText='Bearer secret-header candidate@example.invalid https://private.example/values';
 const raw={
  id:'00000000-0000-0000-0000-000000000001',
  user_id:'00000000-0000-0000-0000-000000000002',
  spreadsheet_id:'fictional-spreadsheet',sheet_url:'https://docs.google.com/spreadsheets/d/fictional/edit',
  last_error:privateText,connection_status:'error',auto_sync_enabled:false
 };
 const safe=redactHistoricalIntegrationError(raw);
 assert.equal(safe.last_error,SAFE_CANDIDATE_SYNC_ERROR);
 assert.equal(safe.user_id,raw.user_id);
 assert.equal(safe.sheet_url,raw.sheet_url);
 assert(!JSON.stringify(safe).includes(privateText));
 assert.equal(redactHistoricalIntegrationError({...raw,last_error:null}).last_error,null);
 assert.equal(redactHistoricalIntegrationError({...raw,last_error:''}).last_error,null);
 assert.throws(()=>redactHistoricalIntegrationError(null),/malformed/);
 assert.throws(()=>redactHistoricalIntegrationError([]),/malformed/);
});
test('Build99 owner settings read uses explicit field allowlist, never historical provider error or raw browser exception',()=>{
 const src=file('src/lib/sheets-sync.server.ts');
 const section=src.slice(src.indexOf('export async function getSavedGoogleIntegration('),
  src.indexOf('export async function saveGoogleIntegrationSettings('));
 const projection=/\.select\("([^"]+)"\)/.exec(section)?.[1];
 assert(projection,'Missing explicit integration select');
 const fields=projection.split(',');
 assert(fields.includes('user_id'));
 assert(fields.includes('sheet_url'));
 assert(fields.includes('column_mapping'));
 assert(fields.includes('connection_status'));
 assert(!fields.includes('last_error'));
 assert.equal(new Set(fields).size,fields.length);
 assert(!section.includes('.select("*")'));
 assert(section.includes('return redactHistoricalIntegrationError({...(data as GoogleIntegrationSettings),last_error:null})'));
 assert(section.includes('.eq("user_id", opts.userId)'));
 const save=src.slice(src.indexOf('export async function saveGoogleIntegrationSettings('),
  src.indexOf('export async function saveDetectedHeaders('));
 assert(save.includes('return redactHistoricalIntegrationError(data as GoogleIntegrationSettings)'));
 assert(save.includes('assertExternalEffectReleased("integration_configuration")'));
 const ui=file('src/routes/_app.integrations.tsx');
 assert(!ui.includes('console.error("integration load error", integQ.error)'));
 assert(!ui.includes('console.error("sync logs load error", logsQ.error)'));
 assert(ui.includes('console.error("Integration settings unavailable")'));
 assert(ui.includes('console.error("Sync log history unavailable")'));
});
