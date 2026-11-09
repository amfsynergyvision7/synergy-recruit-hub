import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const save=src.slice(src.indexOf('const save = async () =>'),src.indexOf('const remove = async'));
const remove=src.slice(src.indexOf('const remove = async'),src.indexOf('// Filtering used to be scoped'));
test('single-record save handles rejected writes without asserting failure',()=>{
 assert.match(save,/try \{\s*if \(editing\)/);
 assert.match(save,/catch \(cause\)/);
 assert.match(save,/Write outcome unknown\. Inspect refreshed records before retrying/);
 assert.match(save,/await load\(\)/);
});
test('single-record delete handles rejected writes without asserting failure',()=>{
 assert.match(remove,/try \{/);
 assert.match(remove,/catch \(cause\)/);
 assert.match(remove,/Deletion outcome unknown\. Inspect refreshed records before retrying/);
 assert.match(remove,/await load\(\)/);
});
