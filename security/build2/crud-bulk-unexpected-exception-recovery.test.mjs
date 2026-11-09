import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const del=src.slice(src.indexOf('const bulkDelete = async'),src.indexOf('const closeBulkEdit ='));
const edit=src.slice(src.indexOf('const applyBulkEdit = async'),src.indexOf('return (\n    <div'));
for(const [name,section] of [['delete',del],['update',edit]]){
 test(`unexpected bulk ${name} exceptions are presented as unknown outcomes and guard is released`,()=>{
  assert.match(section,new RegExp(`Unexpected bulk ${name} failure; outcome unknown`));
  assert.match(section,/catch \(cause\) \{\s*result = \{ confirmed: new Set<string>\(\), error:/);
  assert.match(section,/finally \{\s*bulkMutationPending\.current = false/);
  assert.match(section,/if \(error \|\| confirmed\.size !== ids\.length\)/);
 });
}
