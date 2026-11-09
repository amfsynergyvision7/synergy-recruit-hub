import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const save=src.slice(src.indexOf('const save = async () =>'),src.indexOf('const remove = async'));
const remove=src.slice(src.indexOf('const remove = async'),src.indexOf('// Filtering used to be scoped'));
test('single-record save blocks repeated submission and releases guard after success or error',()=>{
 assert.match(src,/const singleMutationPending = useRef\(false\)/);
 assert.match(save,/if \(singleMutationPending\.current \|\| bulkMutationPending\.current\) return;\s*singleMutationPending\.current = true;\s*try/);
 assert.match(save,/finally \{\s*singleMutationPending\.current = false/);
});
test('single-record deletion blocks duplicate clicks before confirmation and releases guard',()=>{
 assert.match(remove,/if \(singleMutationPending\.current \|\| bulkMutationPending\.current\) return;\s*if \(!confirm/);
 assert.match(remove,/singleMutationPending\.current = true;\s*try/);
 assert.match(remove,/finally \{\s*singleMutationPending\.current = false/);
});
