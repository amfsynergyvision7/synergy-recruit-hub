import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {uniqueCandidateMatch,reconcileCandidateMatches,escapeIlikeLiteral,advanceContiguousCursor} from '../../src/lib/sync-safety.ts';
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
