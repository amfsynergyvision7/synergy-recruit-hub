import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../../.github/workflows/security-build2-offline.yml', import.meta.url), 'utf8');
const eventPaths = (name, next) => {
 const start = workflow.indexOf('  ' + name + ':\n');
 assert.ok(start >= 0, name + ' trigger missing');
 const end = workflow.indexOf('  ' + next + ':\n', start + 1);
 const section = workflow.slice(start, end >= 0 ? end : workflow.indexOf('permissions:', start));
 return [...section.matchAll(/^\s+- '([^']+)'\s*$/gm)].map(match => match[1]);
};
test('pull request and push security workflows cover identical guarded application paths', () => {
 const push = eventPaths('push', 'pull_request');
 const pr = eventPaths('pull_request', 'permissions');
 assert.ok(push.length >= 15, 'security workflow has unexpectedly few guarded paths');
 assert.equal(new Set(push).size, push.length, 'push contains duplicate paths');
 assert.equal(new Set(pr).size, pr.length, 'pull_request contains duplicate paths');
 assert.deepEqual([...push].sort(), [...pr].sort(), 'push and PR guarded paths diverge');
 for (const path of ['src/routes/_app.bd.tsx','src/lib/bd-demo-model.ts','src/components/AppSidebar.tsx','tests/bd-*.test.mjs']) {
  assert.ok(push.includes(path), 'missing BD guard: ' + path);
 }
});
