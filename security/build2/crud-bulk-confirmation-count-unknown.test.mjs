import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/components/CrudModule.tsx', import.meta.url), 'utf8');
for (const [name, start, end, label] of [
 ['delete', 'const bulkDelete = async', 'const closeBulkEdit', 'Deletion'],
 ['update', 'const applyBulkEdit = async', 'return (\n    <div', 'Update'],
]) {
 test(name + ' unexpected exception reports confirmation count unavailable rather than falsely zero', () => {
  const segment = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  assert.match(segment, /let confirmationCountKnown = true/);
  assert.match(segment, /catch \(cause\) \{\s*confirmationCountKnown = false/);
  assert.ok(segment.includes(label + ' confirmation count unavailable for ${ids.length} requested records.'));
  assert.ok(segment.includes('confirmationCountKnown ?'));
  assert.match(segment, /setSelected\(new Set\(\)\);\s*await load\(\)/);
 });
}
