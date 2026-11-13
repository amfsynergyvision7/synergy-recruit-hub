import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertExternalEffectReleased,isExternalEffectPaused} from '../../src/lib/external-effects-hold.server.ts';
import {redactSyncErrors,sanitizeStoredSyncLogs,SAFE_CANDIDATE_SYNC_ERROR,redactHistoricalIntegrationError,extractApprovedSpreadsheetId,buildSafeSheetValuesPath,approvedCandidateMappingTarget,approvedCandidateHeaderAlias,assertUnambiguousCandidateSheetMapping} from '../../src/lib/sync-safety.ts';
import {CANDIDATE_FIELDS} from '../../src/lib/candidate-fields.ts';
import {loadCompleteDuplicateReviewRows,MAX_COMPLETE_DUPLICATE_SCAN,DUPLICATE_SCAN_PAGE_SIZE} from '../../src/lib/duplicate-scan-pagination.ts';

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
 assert(!save.includes('.select("*")'));
 const responseProjections=[...save.matchAll(/\.select\("([^"]+)"\)\.single\(\)/g)].map(m=>m[1]);
 assert.equal(responseProjections.length,2);
 assert(responseProjections.every(p=>p===projection));
 assert(responseProjections.every(p=>!p.split(',').includes('last_error')));
 const ui=file('src/routes/_app.integrations.tsx');
 assert(!ui.includes('console.error("integration load error", integQ.error)'));
 assert(!ui.includes('console.error("sync logs load error", logsQ.error)'));
 assert(ui.includes('console.error("Integration settings unavailable")'));
 assert(ui.includes('console.error("Sync log history unavailable")'));
});

test('Build100 rejects spoofed Sheets origins while accepting only approved HTTPS spreadsheet links',()=>{
 const id='1CM29gwKIzeXsAppeNwrc8lbYaVMmUclprLuLYuHog4k';
 const allowed=[
  'https://docs.google.com/spreadsheets/d/'+id+'/edit#gid=123',
  'https://docs.google.com/spreadsheets/d/'+id+'/view?usp=sharing',
  'https://docs.google.com/spreadsheets/d/'+id,
  'https://DOCS.GOOGLE.COM/spreadsheets/d/'+id+'/copy'
 ];
 for(const url of allowed)assert.equal(extractApprovedSpreadsheetId(url),id,url);
 for(const url of [
  'http://docs.google.com/spreadsheets/d/'+id+'/edit',
  'https://docs.google.com.evil.invalid/spreadsheets/d/'+id+'/edit',
  'https://evil.invalid/spreadsheets/d/'+id+'/edit',
  'https://a:password@docs.google.com/spreadsheets/d/'+id+'/edit',
  'https://docs.google.com:8443/spreadsheets/d/'+id+'/edit',
  'https://docs.google.com/spreadsheets/d/'+id+'/foo',
  'https://docs.google.com/spreadsheets/d/'+id+'/edit/extra',
  'https://docs.google.com/spreadsheets/d/'+id+'/edit?key=ABC',
  'https://docs.google.com/spreadsheets/d/'+id+'/edit?access_token=ABC',
  'https://docs.google.com/spreadsheets/d/x/edit',
  'https://drive.google.com/file/d/'+id+'/view',
  'https://docs.google.com/not-spreadsheets/d/'+id+'/edit',
  'not-a-url'
 ])assert.equal(extractApprovedSpreadsheetId(url),null,url);
 assert.equal(extractApprovedSpreadsheetId('https://docs.google.com/spreadsheets/d/'+id+'/edit'+'x'.repeat(2100)),null);
});
test('Build100 signed gateway range cannot escape spreadsheet path or inject query/fragment',()=>{
 const id='1CM29gwKIzeXsAppeNwrc8lbYaVMmUclprLuLYuHog4k';
 const simple=buildSafeSheetValuesPath(id,'Form_Responses_1');
 assert.equal(simple,'/spreadsheets/'+id+'/values/Form_Responses_1!A1%3AZ100000');
 const path=buildSafeSheetValuesPath(id,"Operations '26/?# table");
 assert(path.startsWith('/spreadsheets/'+id+'/values/'));
 assert(!path.includes('?'));
 assert(!path.includes('#'));
 const encoded=path.split('/values/')[1];
 assert(!encoded.includes('/'));
 assert.equal(decodeURIComponent(encoded),"'Operations ''26/?# table'!A1:Z100000");
 for(const badId of ['abc','../secret',id+'?key=SECRET',id+'/values/x',id+'#fake',id+'.'] )
  assert.throws(()=>buildSafeSheetValuesPath(badId,'Sheet1'),/identifier is not approved/);
 for(const badTab of ['', '\n', 'Bad\tName', 'x'.repeat(121), 'Bad\u0000Name'])
  assert.throws(()=>buildSafeSheetValuesPath(id,badTab),/tab name is not approved/);
});
test('Build100 credentialed Sheets gateway has bounded JSON streaming, zero redirects, and explicit owner update fencing',()=>{
 const sheetsSource=file('src/lib/sheets-sync.server.ts');
 // Keep the exported defense-in-depth admin check used by the API handlers.
 const adminStart=sheetsSource.indexOf('export async function assertAdminUser(userId: string)');
 const adminEnd=sheetsSource.indexOf('async function gw(',adminStart);
 assert(adminStart>0&&adminEnd>adminStart);
 assert(sheetsSource.slice(adminStart,adminEnd).includes('await assertApprovedRole(userId, ["admin"])'));
 const begin=sheetsSource.indexOf('async function gw(');
 const end=sheetsSource.indexOf('export interface GoogleIntegrationSettings',begin);
 const gateway=sheetsSource.slice(begin,end);
 assert(begin>0&&end>begin);
 assert(gateway.includes('redirect: "error"'));
 assert(gateway.includes('signal: AbortSignal.timeout(15000)'));
 assert(gateway.includes('readResponseTextBounded(res, 1024 * 1024)'));
 assert(gateway.includes('const data: unknown = JSON.parse(body)'));
 assert(!gateway.includes('await res.text()'));
 assert(!gateway.includes('init?.headers'));
 assert(!gateway.includes('...init'));
 assert(gateway.includes('Authorization: `Bearer ${lk}`'));
 assert(gateway.includes('"X-Connection-Api-Key": sk'));
 assert(gateway.includes('Sheets gateway request unavailable; check restricted diagnostics'));
 const fetchSource=sheetsSource.slice(sheetsSource.indexOf('export async function fetchSheetValues('),
  sheetsSource.indexOf('function num(',sheetsSource.indexOf('export async function fetchSheetValues(')));
 assert(fetchSource.includes('assertExternalEffectReleased("integration_configuration")'));
 assert(fetchSource.includes('buildSafeSheetValuesPath(spreadsheetId, sheetName)'));
 assert(fetchSource.includes('data.values.some('));
 const headersSource=sheetsSource.slice(sheetsSource.indexOf('export async function saveDetectedHeaders('),
  sheetsSource.indexOf('export async function resetGoogleIntegrationSyncCursor('));
 const binding=headersSource.indexOf('if (!integration?.user_id');
 const write=headersSource.indexOf('.from("google_integrations")');
 assert(binding>0&&binding<write);
 assert(headersSource.includes('.eq("id", integration.id).eq("user_id", integration.user_id)'));
 assert(headersSource.includes('assertExternalEffectReleased("integration_configuration")'));
 assert(!headersSource.includes('console.log'));
});

test('Build101 fast guard: untrusted Sheet aliases cannot inject CRM owner, role or status fields',()=>{
 const legacy={experience:'experience_years',position:'position_applied'};
 const headers={'full name':'full_name',email:'email',role:'position_applied'};
 assert.equal(approvedCandidateHeaderAlias('role',headers,CANDIDATE_FIELDS),'position_applied');
 assert.equal(approvedCandidateMappingTarget('experience',legacy,CANDIDATE_FIELDS),'experience_years');
 assert.equal(approvedCandidateHeaderAlias(' FULL NAME ',headers,CANDIDATE_FIELDS),'full_name');
 for(const forbidden of ['__proto__','constructor','toString','valueOf','user_id','id',
  'status','stage','created_source','assigned_recruiter','is_active',null,{},1]){
  assert.equal(approvedCandidateMappingTarget(forbidden,legacy,CANDIDATE_FIELDS),undefined);
  assert.equal(approvedCandidateHeaderAlias(forbidden,headers,CANDIDATE_FIELDS),undefined);
 }
 assert.equal(approvedCandidateMappingTarget('role',legacy,CANDIDATE_FIELDS),undefined);
 const code=file('src/lib/sheets-sync.server.ts');
 assert(code.includes('approvedCandidateHeaderAlias(h, FIELD_ALIASES, CANDIDATE_FIELDS)'));
 assert(code.includes('approvedCandidateMappingTarget(field, LEGACY_FIELD_NAMES, CANDIDATE_FIELDS)'));
 const allWrites=[...code.matchAll(/\.eq\("id", integ\.id\)([^;]*);/g)];
 assert.equal(allWrites.length,4);
 assert(allWrites.every(m=>m[1].includes('.eq("user_id", opts.userId)')));
 const start=code.indexOf('async function runCandidateSyncUnsafe(');
 const end=code.indexOf('export async function fetchHeaders(',start);
 const unsafe=code.slice(start,end);
 assert(unsafe.indexOf('integ.user_id !== opts.userId')<unsafe.indexOf('fetchSheetValues(integ.spreadsheet_id, sheetName)'));
});

test('Build102 fast candidate mapping denies duplicate identity/phone fields and unmapped identity sheets',()=>{
 const valid={Email:'email',Phone:'mobile',Position:'position_applied'};
 assert.doesNotThrow(()=>assertUnambiguousCandidateSheetMapping(
  ['Email','Phone','Position'],valid,CANDIDATE_FIELDS));
 assert.doesNotThrow(()=>assertUnambiguousCandidateSheetMapping(['Email','',''],{Email:'email'},CANDIDATE_FIELDS));
 assert.throws(()=>assertUnambiguousCandidateSheetMapping(['Email',''],{Email:'email','':'mobile'},CANDIDATE_FIELDS),/blank mapped header/);
 assert.throws(()=>assertUnambiguousCandidateSheetMapping(
  ['Email','Email Address'],{Email:'email','Email Address':'email'},CANDIDATE_FIELDS),
  /duplicate mapped field/);
 assert.throws(()=>assertUnambiguousCandidateSheetMapping(
  ['Mobile','Phone'],{Mobile:'mobile',Phone:'mobile'},CANDIDATE_FIELDS),
  /duplicate mapped field/);
 assert.throws(()=>assertUnambiguousCandidateSheetMapping(
  ['Position','Notes'],{Position:'position_applied',Notes:'notes'},CANDIDATE_FIELDS),
  /mapped identity column/);
 assert.throws(()=>assertUnambiguousCandidateSheetMapping(
  ['Email'],{Email:'assigned_recruiter'},CANDIDATE_FIELDS),
  /mapped field is not approved/);
 const source=file('src/lib/sheets-sync.server.ts');
 const start=source.indexOf('async function runCandidateSyncUnsafe(');
 const code=source.slice(start,source.indexOf('export async function runCandidateSync(',start));
 const gate=code.indexOf('assertUnambiguousCandidateSheetMapping(headers, mapping, CANDIDATE_FIELDS)');
 assert(gate>0&&gate<code.indexOf('update({ column_mapping: mapping })'));
 assert(gate<code.indexOf('"crm_commit_candidate_sync_row"'));
});

function build109MockCandidateClient(rows, opts={}){
 const calls=[];
 return {
  calls,
  from(table){
   assert.equal(table,'candidates');
   return {
    select(columns, options){
     assert(columns.includes('id'));
     assert.equal(options.count,'exact');
     return {
      order(column, options){
       assert(['created_at','id'].includes(column));
       assert.equal(options.ascending,true);
       return this;
      },
      async range(start,end){
       calls.push([start,end]);
       let data=rows.slice(start,Math.min(end+1,start+(opts.serverMaxRows??9999)));
       if(opts.duplicateAt!==undefined&&start>0&&data.length)
        data[0]={...data[0],id:rows[0].id};
       if(opts.replaceAt===calls.length&&data.length)
        data[0]={...data[0],id:'changed-same-count-row'};
       return {
        data,
        count:rows.length+(opts.driftAt===calls.length?1:0),
        error:opts.errorAt===calls.length?{message:'PRIVATE bearer secret email@example.invalid'}:null
       };
      }
     };
    }
   };
  }
 };
}
test('Build109 duplicate paging retrieves every candidate despite PostgREST page limits',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({id:'fake-'+i,created_at:'2026-01-01T00:00:00Z'}));
 const mock=build109MockCandidateClient(rows);
 const result=await loadCompleteDuplicateReviewRows(mock,'id, created_at');
 assert.equal(result.length,1001);
 assert.equal(new Set(result.map(r=>r.id)).size,1001);
 assert.deepEqual(mock.calls,[[0,499],[500,999],[1000,1499],[0,499],[500,999],[1000,1499]]);
 assert.equal(DUPLICATE_SCAN_PAGE_SIZE,500);
 assert.equal(MAX_COMPLETE_DUPLICATE_SCAN,5000);
 const blank=build109MockCandidateClient([]);
 assert.deepEqual(await loadCompleteDuplicateReviewRows(blank,'id, created_at'),[]);
 assert.deepEqual(blank.calls,[[0,499],[0,499]]);
});
test('Build109 duplicate review never returns a silent partial result beyond or below the scan cap',async()=>{
 const all=Array.from({length:5000},(_,i)=>({id:'candidate-'+i}));
 const exact=build109MockCandidateClient(all);
 assert.equal((await loadCompleteDuplicateReviewRows(exact,'id')).length,5000);
 assert.equal(exact.calls.length,20);
 const over=build109MockCandidateClient([...all,{id:'candidate-over-limit'}]);
 await assert.rejects(loadCompleteDuplicateReviewRows(over,'id'),/no partial results returned/);
 assert.equal(over.calls.length,1,'Do not expose a partial report when over 5000');
 const truncated=build109MockCandidateClient(all.slice(0,800),{serverMaxRows:200});
 await assert.rejects(loadCompleteDuplicateReviewRows(truncated,'id'),/no partial results returned/);
 const countDrift=build109MockCandidateClient(all.slice(0,600),{driftAt:2});
 await assert.rejects(loadCompleteDuplicateReviewRows(countDrift,'id'),/no partial results returned/);
 const duplicate=build109MockCandidateClient(all.slice(0,600),{duplicateAt:500});
 await assert.rejects(loadCompleteDuplicateReviewRows(duplicate,'id'),/no partial results returned/);
 const leaked=build109MockCandidateClient(all.slice(0,10),{errorAt:1});
 await assert.rejects(loadCompleteDuplicateReviewRows(leaked,'id'),e=>
   e.message==='Complete duplicate review unavailable; no partial results returned');
 const thrown={from(){throw new Error('PRIVATE Supabase URL and bearer token in network exception')}};
 await assert.rejects(loadCompleteDuplicateReviewRows(thrown,'id'),e=>
   e.message==='Complete duplicate review unavailable; no partial results returned');
});
test('Build109 duplicate reviewer enforces unique admin role before any paginated contacts are read',()=>{
 const source=file('src/lib/duplicates.server.ts');
 const api=file('src/lib/duplicates.functions.ts');
 const helper=file('src/lib/duplicate-scan-pagination.ts');
 const role=source.indexOf('await assertApprovedRole(actorUserId, ["admin"])');
 const paged=source.indexOf('await loadCompleteDuplicateReviewRows<DuplicateCandidate>');
 assert(role>=0&&paged>role);
 assert(!source.includes('.limit(5000)'));
 assert(!source.includes('data ?? []'));
 assert(helper.includes('.select(columns, { count: "exact" })'));
 assert(helper.includes('.order("created_at", { ascending: true })'));
 assert(helper.includes('.order("id", { ascending: true })'));
 assert(helper.includes('count > MAX_COMPLETE_DUPLICATE_SCAN'));
 assert(helper.includes('data.length !== expectedLength'));
 assert(helper.includes('ids.has(row.id)'));
 assert(helper.includes('pass === 1 && count !== result.length'));
 assert(helper.includes('result[offset + i]?.id !== row.id'));
 assert(api.includes('await assertApprovedRole(context.userId, ["admin"])'));
 assert(api.includes('return findDuplicateClusters(context.supabase, context.userId)'));
});

test('Build109 stale duplicate review data cannot be displayed or exported after a failed rescan',()=>{
 const ui=file('src/routes/_app.duplicates.tsx');
 assert(ui.includes('const summary = query.isError || query.isFetching ? undefined : query.data;'));
 assert(ui.includes('selection.scanVersion === query.dataUpdatedAt'));
 assert(ui.includes('ids: apply(previous.scanVersion === query.dataUpdatedAt'));
 assert(ui.includes('const clusters = summary?.clusters ?? [];'));
 assert(ui.includes('if (!summary || query.isError || query.isFetching)'));
 assert(ui.includes('disabled={!summary || query.isError || query.isFetching || totalSelected === 0}'));
 assert(ui.includes('A completed duplicate review scan is required before export.'));
 assert(ui.includes('{query.isError && !query.isPending && ('));
 assert(ui.includes('{summary && !query.isPending && ('));
 assert(ui.includes('buildDuplicateReviewCSV(clusters, selected)'));
 assert(!ui.includes('const summary = query.data;'));
});

test('Build110 count-preserving pagination shift is rejected during independent ID-only verification',async()=>{
 const rows=Array.from({length:650},(_,i)=>({id:'synthetic-'+i,created_at:'2026-01-01T00:00:00Z'}));
 const changed=build109MockCandidateClient(rows,{replaceAt:3});
 await assert.rejects(loadCompleteDuplicateReviewRows(changed,'id, created_at'),
  e=>e.message==='Complete duplicate review unavailable; no partial results returned');
 assert.deepEqual(changed.calls,[[0,499],[500,999],[0,499]]);
 const stable=build109MockCandidateClient(rows);
 assert.equal((await loadCompleteDuplicateReviewRows(stable,'id, created_at')).length,650);
 assert.deepEqual(stable.calls,[[0,499],[500,999],[0,499],[500,999]]);
});

test('Build110 second-pass provider failure also suppresses incomplete candidate reviews',async()=>{
 const rows=Array.from({length:600},(_,i)=>({id:'synthetic-'+i}));
 const failed=build109MockCandidateClient(rows,{errorAt:3});
 await assert.rejects(loadCompleteDuplicateReviewRows(failed,'id'),
  e=>e.message==='Complete duplicate review unavailable; no partial results returned');
 assert.equal(failed.calls.length,3);
 const ui=file('src/routes/_app.duplicates.tsx');
 assert(ui.includes('const summary = query.isError || query.isFetching ? undefined : query.data;'));
 assert(ui.includes('const selected = useMemo('));
 assert(ui.includes('scanVersion: query.dataUpdatedAt'));
 assert(ui.includes('const updateSelected = (apply:'));
 assert(!ui.includes('setSelected((prev)'));
});
