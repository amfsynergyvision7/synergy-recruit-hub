import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/routes/_app.candidates.tsx',import.meta.url),'utf8');
test('candidate recruiter assignment list filters approved AND active profiles',()=>{
 const q=src.slice(src.indexOf('const fetchRecruiters'),src.indexOf('fetchRecruiters();'));
 assert.match(q,/\.from\('profiles'\)/);
 assert.match(q,/\.eq\('status', 'approved'\)/);
 assert.match(q,/\.eq\('is_active', true\)/);
 assert.ok(q.indexOf(".eq('status', 'approved')")<q.indexOf(".eq('is_active', true)"));
});
