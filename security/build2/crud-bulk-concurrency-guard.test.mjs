import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const del=src.slice(src.indexOf('const bulkDelete = async'),src.indexOf('const closeBulkEdit ='));
const edit=src.slice(src.indexOf('const applyBulkEdit = async'),src.indexOf('return (\n    <div'));
test('bulk delete rejects overlapping requests and clears guard in finally',()=>{
 assert.match(src,/const bulkMutationPending = useRef\(false\)/);
 assert.match(del,/if \(bulkMutationPending\.current \|\| singleMutationPending\.current\) return/);
 assert.match(del,/bulkMutationPending\.current = true/);
 assert.match(del,/finally \{\s*bulkMutationPending\.current = false;\s*setBulkDeleting\(false\)/);
});
test('bulk edit shares mutation guard and always releases loading state',()=>{
 assert.match(edit,/if \(bulkMutationPending\.current \|\| singleMutationPending\.current\) return/);
 assert.match(edit,/bulkMutationPending\.current = true/);
 assert.match(edit,/finally \{\s*bulkMutationPending\.current = false;\s*setBulkEditSaving\(false\)/);
});
