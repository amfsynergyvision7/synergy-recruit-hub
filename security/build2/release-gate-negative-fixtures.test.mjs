import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = new URL('./', import.meta.url);
const original = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(new URL('release-evidence.json', root), 'utf8')));
const run = (value, raw = false) => {
 const dir = mkdtempSync(join(tmpdir(), 'build2-release-gate-'));
 try {
  copyFileSync(new URL('release-gate.mjs', root), join(dir, 'release-gate.mjs'));
  if (value !== undefined) writeFileSync(join(dir, 'release-evidence.json'), raw ? value : JSON.stringify(value));
  return spawnSync(process.execPath, [join(dir, 'release-gate.mjs')], { encoding: 'utf8' });
 } finally { rmSync(dir, { recursive: true, force: true }); }
};
test('missing and malformed evidence blocks release explicitly', () => {
 for (const [value, raw] of [[undefined,false], ['{invalid',true], ['null',true], ['[]',true]]) {
  const r = run(value, raw);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PRODUCTION RELEASE BLOCKED/);
 }
});
test('true without independently recorded evidence remains blocked', () => {
 const values = structuredClone(original);
 values.release_approved = { passed: true, evidence: '   ' };
 const r = run(values);
 assert.equal(r.status, 1);
 assert.match(r.stdout, /BLOCK \| release_approved/);
});
test('partial positive evidence does not unblock other release conditions', () => {
 const values = structuredClone(original);
 values.isolated_postgresql_rls_tests_passed = { passed: true, evidence: 'synthetic CI result (not staging)' };
 const r = run(values);
 assert.equal(r.status, 1);
 assert.equal((r.stdout.match(/BLOCK \|/g) ?? []).length, 8);
});
