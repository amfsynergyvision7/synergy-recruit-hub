import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/components/CrudModule.tsx', import.meta.url), 'utf8');
const parts = [
  ['delete', source.slice(source.indexOf('const bulkDelete = async'), source.indexOf('const closeBulkEdit ='))],
  ['update', source.slice(source.indexOf('const applyBulkEdit = async'), source.indexOf('return (\n    <div'))],
];
for (const [action, section] of parts) {
  test(`uncertain bulk ${action} clears replay selection and requires operator reconciliation`, () => {
    assert.match(section, /if \(error \|\| confirmed\.size !== ids\.length\) \{/);
    assert.match(section, /setSelected\(new Set\(\)\);\s*await load\(\)/);
    assert.match(section, /Other outcomes may be unknown\. Inspect refreshed records and reselect targets before retrying/);
    assert.doesNotMatch(section, /setSelected\(new Set\(ids\.filter/);
  });
}
