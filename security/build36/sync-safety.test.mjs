import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {uniqueCandidateMatch,reconcileCandidateMatches,escapeIlikeLiteral,advanceContiguousCursor,approvedCandidateMappingTarget,approvedCandidateHeaderAlias} from '../../src/lib/sync-safety.ts';
import {CANDIDATE_FIELDS} from '../../src/lib/candidate-fields.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const A={id:'A',full_name:'Synthetic A'},B={id:'B',full_name:'Synthetic B'};
for(const [name,rows,result] of [['missing',null,null],['empty',[],null],['one',[A],A]]) {
 test('unique candidate lookup '+name,()=>assert.deepEqual(uniqueCandidateMatch(rows),result));
}
for(const rows of [[A,B],[A,A]])test('ambiguous duplicate matches deny update',()=>assert.throws(()=>uniqueCandidateMatch(rows),/Ambiguous/));
for(const [mobile,email,result] of [[null,null,null],[A,null,A],[null,A,A],[A,A,A]]) {
 test('matching identities are safely resolved',()=>assert.deepEqual(reconcileCandidateMatches(mobile,email),result));
}
test('mobile and email identifying different records must not merge',()=>assert.throws(()=>reconcileCandidateMatches(A,B),/Conflicting/));
for(const [input,expected] of [['a_b@example.com','a\\_b@example.com'],['a%b@example.com','a\\%b@example.com'],['a\\b@example.com','a\\\\b@example.com'],['safe@example.com','safe@example.com']]) {
 test('literal escaped ILIKE pattern '+input,()=>assert.equal(escapeIlikeLiteral(input),expected));
}
for(const [prior,next] of [[1,2],[2,3],[19,20]])test('contiguous row cursor can advance',()=>assert.equal(advanceContiguousCursor(prior,next),next));
for(const [prior,next] of [[1,3],[3,3],[3,2],[-1,0],[0,1.5],[Infinity,1]])test('cursor gaps and invalid rows fail',()=>assert.throws(()=>advanceContiguousCursor(prior,next),/Non-contiguous/));
test('actual importer has owner, exact-match and fail-fast guards',()=>{
 const code=readFileSync(resolve(root,'src/lib/sheets-sync.server.ts'),'utf8');
 assert.match(code,/if \(!opts\.userId\) throw new Error\("Explicit sync owner required"\)/);
 assert.match(code,/uniqueCandidateMatch<[^>]+>\(matches\)/);
 assert.match(code,/reconcileCandidateMatches\(mobileMatch, emailMatch\)/);
 assert.match(code,/escapeIlikeLiteral\(cand\.email\)/);
 const batch=code.slice(code.indexOf('for (let i = startIdx;'),code.indexOf('result.created = result.rows_created;'));
 assert.match(batch,/catch(?:\s*\([^)]*\))?\s*\{[\s\S]*?result\.rows_skipped\+\+;\s*break;/);
 assert.match(batch,/result\.error_details\.push\(\{ row: sheetRowNumber, message: SAFE_CANDIDATE_SYNC_ERROR \}\)/);
 assert.doesNotMatch(batch,/e\?\.message|String\(e\)/);
 assert.match(batch,/lastSynced = advanceContiguousCursor/);
});
test('matching queries detect duplicate rows rather than choosing latest silently',()=>{
 const code=readFileSync(resolve(root,'src/lib/sheets-sync.server.ts'),'utf8');
 const batch=code.slice(code.indexOf('for (let i = startIdx;'),code.indexOf('result.created = result.rows_created;'));
 assert.equal((batch.match(/\.limit\(2\)/g)||[]).length,2);
 assert.doesNotMatch(batch,/\.limit\(1\)\.maybeSingle\(\)/);
});

test('Build101 candidate mapping rejects role/id/owner injection and inherited JS prototype keys',()=>{
 const legacy={position:'position_applied',experience:'experience_years'};
 const expected=[
  ['position','position_applied'],['experience','experience_years'],
  ['full_name','full_name'],['mobile','mobile'],['source','source'],
  ['email','email'],['notes','notes'],['resume_url','resume_url']
 ];
 for(const [input,output] of expected)
  assert.equal(approvedCandidateMappingTarget(input,legacy,CANDIDATE_FIELDS),output);
 for(const input of ['__proto__','constructor','toString','hasOwnProperty',
  'id','user_id','assigned_recruiter','stage','status','created_at','created_source',
  'auth_uid','role','is_active','client_id','billing','profile_id',
  null,undefined,42,{},[],false]){
   assert.equal(approvedCandidateMappingTarget(input,legacy,CANDIDATE_FIELDS),undefined,
    'Unauthorized DB field: '+String(input));
 }
 const inherited=Object.create({role:'full_name',constructor:'full_name'});
 assert.equal(approvedCandidateMappingTarget('role',inherited,CANDIDATE_FIELDS),undefined);
 assert.equal(approvedCandidateMappingTarget('constructor',inherited,CANDIDATE_FIELDS),undefined);
 const malicious={position:'user_id'};
 assert.equal(approvedCandidateMappingTarget('position',malicious,CANDIDATE_FIELDS),undefined);
});
test('Build101 spreadsheet auto-header aliases allow only own, approved mapped fields',()=>{
 const aliases={'full name':'full_name','e-mail':'email','mobile':'mobile',role:'position_applied'};
 for(const [header,field] of [
  [' FULL NAME ','full_name'],['E-Mail','email'],['Mobile','mobile'],
  ['ROLE','position_applied']])
  assert.equal(approvedCandidateHeaderAlias(header,aliases,CANDIDATE_FIELDS),field);
 for(const label of ['constructor','__proto__','toString','valueOf','hasOwnProperty',
  'user_id','assigned_recruiter','id','created_source','email'.repeat(130),
  '',null,undefined,{},42]){
  assert.equal(approvedCandidateHeaderAlias(label,aliases,CANDIDATE_FIELDS),undefined,
   'Untrusted label: '+String(label));
 }
 const polluted=Object.create({email:'email'});
 assert.equal(approvedCandidateHeaderAlias('email',polluted,CANDIDATE_FIELDS),undefined);
 const unsafe={'full name':'user_id'};
 assert.equal(approvedCandidateHeaderAlias('full name',unsafe,CANDIDATE_FIELDS),undefined);
});
test('Build101 live importer uses strict mapping helpers and every privileged integration write is owner fenced',()=>{
 const code=readFileSync(resolve(root,'src/lib/sheets-sync.server.ts'),'utf8');
 assert(code.includes('approvedCandidateMappingTarget(field, LEGACY_FIELD_NAMES, CANDIDATE_FIELDS)'));
 assert(code.includes('approvedCandidateHeaderAlias(h, FIELD_ALIASES, CANDIDATE_FIELDS)'));
 assert(code.includes('CANDIDATE_FIELDS.includes(field as typeof CANDIDATE_FIELDS[number])'));
 const start=code.indexOf('async function runCandidateSyncUnsafe(');
 const end=code.indexOf('export async function fetchHeaders(',start);
 const section=code.slice(start,end);
 assert(start>0&&end>start);
 const writes=[...section.matchAll(/\.eq\("id", integ\.id\)([^;]*);/g)];
 assert.equal(writes.length,5,'All five integration write sites must be inspected');
 for(const match of writes)
  assert(match[1].includes('.eq("user_id", opts.userId)'),'Missing owner filter on integration update');
 const owner=section.indexOf('integ.user_id !== opts.userId');
 const sheetRead=section.indexOf('fetchSheetValues(integ.spreadsheet_id, sheetName)');
 assert(owner>0&&sheetRead>owner);
 assert(!section.includes('.eq("id", integ.id);'));
});
