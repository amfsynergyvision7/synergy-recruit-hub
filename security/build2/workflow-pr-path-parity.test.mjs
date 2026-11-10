import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../../.github/workflows/security-build2-offline.yml', import.meta.url), 'utf8');
const eventPaths = (name, next) => {
 const start = workflow.indexOf('  ' + name + ':\n');
 assert.ok(start >= 0, name + ' trigger missing');
 const end = workflow.indexOf('  ' + next + ':\n', start + 1);
 return workflow.slice(start, end >= 0 ? end : workflow.indexOf('permissions:', start));
};
test('pull request and push security workflows cover the same guarded application files', () => {
 const push = eventPaths('push', 'pull_request');
 const pr = eventPaths('pull_request', 'permissions');
 for (const path of [
  'security/build2/**',
  'src/components/CrudModule.tsx',
  'src/components/CandidateBoard.tsx',
  'src/routes/_app.candidates.tsx',
  '.github/workflows/security-build2-offline.yml',
 ]) {
  assert.ok(push.includes("'" + path + "'"), 'push missing ' + path);
  assert.ok(pr.includes("'" + path + "'"), 'pull_request missing ' + path);
 }
});
