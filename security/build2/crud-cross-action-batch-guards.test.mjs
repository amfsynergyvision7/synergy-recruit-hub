import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/components/CrudModule.tsx', import.meta.url), 'utf8');
const section = (start, end) => src.slice(src.indexOf(start), src.indexOf(end));
const save = section('const save = async', 'const remove = async');
const remove = section('const remove = async', '// Filtering used to be scoped');
const bulkDelete = section('const bulkDelete = async', 'const closeBulkEdit');
const bulkEdit = section('const applyBulkEdit = async', 'return (\n    <div');
const toggleAll = section('const toggleAll =', 'const toggleRow =');
const toggleRow = section('const toggleRow =', '// Keep returned IDs');
test('single-record save and delete reject operations during bulk mutation', () => {
 for (const body of [save, remove]) assert.match(body, /if \(singleMutationPending\.current \|\| bulkMutationPending\.current\) return/);
});
test('bulk edit and delete reject operations during single-record mutation', () => {
 for (const body of [bulkDelete, bulkEdit]) assert.match(body, /if \(bulkMutationPending\.current \|\| singleMutationPending\.current\) return/);
});
test('bulk selection cannot be toggled while a bulk mutation is pending', () => {
 for (const body of [toggleAll, toggleRow]) assert.match(body, /if \(bulkMutationPending\.current\) return/);
});
