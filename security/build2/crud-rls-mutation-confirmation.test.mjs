import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const segment=(start,end)=>{
 const a=source.indexOf(start);assert.ok(a>=0,'missing '+start);
 const b=source.indexOf(end,a+start.length);assert.ok(b>a,'missing boundary '+end);
 return source.slice(a,b);
};
test('single CRUD mutations verify returned IDs and reject zero-row success',()=>{
 const save=segment('const save = async () =>','const remove = async');
 const remove=segment('const remove = async','// Filtering used');
 assert.match(save,/\.update\(payload\)\.eq\("id", editing\.id\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(save,/!data \|\| data\.id !== editing\.id/);
 assert.match(save,/\.insert\(payload\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(save,/!data\?\.id/);
 assert.match(remove,/\.delete\(\)\.eq\("id", row\.id\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(remove,/!data \|\| data\.id !== row\.id/);
});
test('bulk CRUD confirms exact affected ID set, flags partial outcomes and reloads',()=>{
 const del=segment('const bulkDelete = async','const closeBulkEdit');
 const edit=segment('const applyBulkEdit = async','return (');
 for(const [name,part] of [['delete',del],['edit',edit]]){
  assert.match(part,/\.in\("id", ids\)\.select\("id"\)/,name+' must return affected IDs');
  assert.match(part,/const confirmed = new Set/);
  assert.match(part,/confirmed\.size !== ids\.length \|\| ids\.some\(\(id\) => !confirmed\.has\(id\)\)/);
  assert.match(part,/await load\(\)/);
  assert.ok(part.indexOf('if (confirmed.size !== ids.length')<part.indexOf('toast.success('));
 }
});
