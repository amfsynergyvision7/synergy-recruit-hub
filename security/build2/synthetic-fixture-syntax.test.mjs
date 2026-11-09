import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('.', import.meta.url);
const sql = readFileSync(new URL('synthetic-view-rls.integration.sql', root), 'utf8');

test('synthetic SQL contains balanced PL/pgSQL dollar quote delimiters', () => {
  const starts = [...sql.matchAll(/\bDO\s+\$\$/g)].length;
  const ends = [...sql.matchAll(/\bEND\s+\$\$\s*;/g)].length;
  assert.equal(starts, ends, 'each DO $$ block must end with END $$;');
  assert.ok(starts >= 8, 'negative authorization blocks must remain present');
  assert.doesNotMatch(sql, /\bDO\s+\$(?!\$)/, 'malformed DO $ delimiter');
  assert.doesNotMatch(sql, /\bEND\s+\$(?!\$)\s*;/, 'malformed END $ delimiter');
});

test('negative authorization cases remain in synthetic fixture', () => {
  for (const expected of [
    'cross-recruiter update unexpectedly succeeded',
    'ownership reassignment unexpectedly succeeded',
    'missing auth identity revealed',
    'cross-recruiter view leakage',
    'anon must not SELECT synthetic view',
    'recruiter must not update ownership column'
  ]) assert.ok(sql.includes(expected), `missing check: ${expected}`);
});

test('synthetic fixture is not a production migration', () => {
  assert.match(sql, /ISOLATED TEST FIXTURE ONLY/);
  assert.match(sql, /build2_synthetic_candidates/);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\.(?!build2_synthetic_)/i);
});
