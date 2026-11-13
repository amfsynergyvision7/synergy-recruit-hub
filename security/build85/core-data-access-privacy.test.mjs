import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertExternalEffectReleased } from '../../src/lib/external-effects-hold.server.ts';

const sourceFile = (path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const ai=sourceFile('src/lib/ai.server.ts');
const aiApi=sourceFile('src/lib/ai.functions.ts');
const resume=sourceFile('src/lib/resume-fetch.server.ts');
const importer=sourceFile('src/lib/drive-import.server.ts');
const duplicates=sourceFile('src/lib/duplicates.server.ts');
const duplicateApi=sourceFile('src/lib/duplicates.functions.ts');

test('Build85 release guard always rejects candidate AI and Drive import before provider access',()=>{
 assert.throws(()=>assertExternalEffectReleased('candidate_ai_processing'),/paused pending privacy and release approval/);
 assert.throws(()=>assertExternalEffectReleased('drive_bulk_import'),/paused pending privacy and release approval/);
});

test('Build85 all six exported AI implementations fail closed before candidate or job query',()=>{
 const names=[
  'matchCandidatesToJob','matchCandidateResume','generateResumeSummary',
  'extractCandidateFieldsFromResume','generateCandidateAtsScore','restructureResumeForClient'
 ];
 for (const name of names) {
  const i=ai.indexOf('export async function '+name+'(');
  assert(i>=0,'Missing low-level '+name);
  const end=ai.indexOf('\nexport ',i+20);
  const section=ai.slice(i,end>=0?end:undefined);
  const gate=section.indexOf('assertExternalEffectReleased("candidate_ai_processing")');
  assert(gate>=0&&gate<500,name+' privacy guard must be at entry');
  const reads=[section.indexOf('.from("candidates")'),section.indexOf('.from("job_openings")'),section.indexOf('callGeminiJSON<')].filter(n=>n>=0);
  if(reads.length)assert(gate<Math.min(...reads),name+' guard must precede DB or provider calls');
 }
 assert.equal((ai.match(/assertExternalEffectReleased\("candidate_ai_processing"\)/g)||[]).length,7);
});

test('Build85 Gemini API key and outbound HTTP request are separately protected inside provider wrapper',()=>{
 const start=ai.indexOf('async function callGeminiJSON');
 const end=ai.indexOf('const MATCH_SCHEMA',start);
 const body=ai.slice(start,end);
 const hold=body.indexOf('assertExternalEffectReleased("candidate_ai_processing")');
 const key=body.indexOf('process.env.GEMINI_API_KEY');
 const fetch=body.indexOf('await fetch(GEMINI_ENDPOINT');
 assert(hold>=0&&key>hold&&fetch>key);
 assert(body.includes('redirect: "error"'));
});

test('Build85 saved resume URL and raw Drive bytes reject direct caller before link parsing or downloading',()=>{
 const saved=resume.slice(resume.indexOf('export async function fetchResumeText('));
 const guard=saved.indexOf('assertExternalEffectReleased("candidate_ai_processing")');
 assert(guard>=0&&guard<saved.indexOf('if (!resumeUrl)'));
 const core=resume.slice(resume.indexOf('export async function fetchDriveBytes('),resume.indexOf('export async function extractText('));
 const gate=core.indexOf('assertExternalEffectReleased(purpose)');
 assert(gate>0&&gate<core.indexOf('downloadRemoteBounded(baseUrl, policy)'));
 assert(core.includes('purpose: "candidate_ai_processing" | "drive_bulk_import" = "candidate_ai_processing"'));
 assert(importer.includes('fetchDriveBytes(file.id, "drive_bulk_import")'));
 assert(!importer.includes('fetchDriveBytes(file.id);'));
});

test('Build85 low-level duplicate scan verifies unique active administrator before 5000 candidate records',()=>{
 assert(duplicates.includes('import { assertApprovedRole } from "./access-gates.server"'));
 const start=duplicates.indexOf('export async function findDuplicateClusters(');
 const paged=duplicates.indexOf('await loadCompleteDuplicateReviewRows<DuplicateCandidate>',start);
 const check=duplicates.indexOf('await assertApprovedRole(actorUserId, ["admin"])',start);
 assert(start>=0&&check>start&&paged>check);
 const paging=readFileSync('src/lib/duplicate-scan-pagination.ts','utf8');
 assert(paging.includes('.from("candidates")'));
 assert(paging.includes('.select(columns, { count: "exact" })'));
 assert(paging.includes('count > MAX_COMPLETE_DUPLICATE_SCAN'));
 assert(!duplicates.includes('.limit(5000)'));
 assert(duplicates.includes('findDuplicateClusters(supabase: any, actorUserId: string)'));
 assert(duplicateApi.includes('return findDuplicateClusters(context.supabase, context.userId)'));
 assert(duplicateApi.includes('await assertApprovedRole(context.userId, ["admin"])'));
});

test('Build85 all six public candidate-AI handlers remain independently held at entry',()=>{
 assert.equal((aiApi.match(/assertExternalEffectReleased\("candidate_ai_processing"\)/g)||[]).length,5);
 assert.equal((aiApi.match(/assertExternalEffectReleased\("drive_bulk_import"\)/g)||[]).length,1);
 assert.equal((aiApi.match(/await assertApprovedRole\(context.userId,/g)||[]).length,6);
});
