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
 assert.match(save,/!data \|\| \(data as unknown as \{ id: string \}\)\.id !== editing\.id/);
 assert.match(save,/\.insert\(payload\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(save,/id\?: string/);
 assert.match(remove,/\.delete\(\)\.eq\("id", row\.id\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(remove,/!data \|\| \(data as unknown as \{ id: string \}\)\.id !== row\.id/);
});
test('bulk CRUD verifies each bounded batch and stops on partial results',()=>{
 const helper=segment('const confirmBulkBatches = async','const bulkDelete = async');
 const del=segment('const bulkDelete = async','const closeBulkEdit');
 const edit=segment('const applyBulkEdit = async','return (');
 assert.match(helper,/start \+= 100/);
 assert.match(helper,/ids\.slice\(start, start \+ 100\)/);
 assert.match(helper,/\.in\("id", batch\)/);
 assert.match(helper,/query\.select\("id"\)/);
 assert.match(helper,/catch \(cause\)/);
 assert.match(helper,/return \{ confirmed, error: cause instanceof Error/);
 assert.match(helper,/returnedSet\.size !== batch\.length/);
 assert.match(helper,/batch\.some\(\(id\) => !returnedSet\.has\(id\)\)/);
 for(const [name,part] of [['delete',del],['edit',edit]]){
  assert.match(part,/confirmBulkBatches\(ids,/,name+' must use verified batches');
  assert.match(part,/error \|\| confirmed\.size !== ids\.length/);
  assert.match(part,/await load\(\)/);
  assert.match(part,/setSelected\(new Set\(ids\.filter\(\(id\) => !confirmed\.has\(id\)\)\)\)/);
  assert.ok(part.indexOf('if (error || confirmed.size !== ids.length')<part.indexOf('toast.success('));
 }
});
