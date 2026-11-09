import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const save=source.slice(source.indexOf('const save = async () =>'),source.indexOf('const remove = async'));
test('CRUD diff normalizes blank and missing values to null',()=>{
 assert.match(save,/oldValue === "" \|\| oldValue === undefined \? null : oldValue/);
 assert.match(save,/normalizedOld === null && v === null/);
 assert.doesNotMatch(save,/String\(oldValue\) !== String\(v\)/);
});
test('CRUD diff compares finite numeric values and retains type-sensitive comparisons',()=>{
 assert.match(save,/normalizedOld !== null && v !== null && Number\(normalizedOld\) === v/);
 assert.match(save,/normalizedOld === v/);
 assert.match(save,/if \(!editing \|\| !sameValue\) payload\[f\.name\] = v/);
 assert.ok(save.indexOf('if (invalidNumber)')<save.indexOf('const payload: any = {}'));
});
