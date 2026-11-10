import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const between=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+a.length));
test('single-record form rejects non-finite numeric values before payload construction',()=>{
 const save=between('const save = async () =>','const remove = async');
 assert.match(save,/const invalidNumber = formFields\.find/);
 assert.match(save,/!Number\.isFinite\(Number\(form\[f\.name\]\)\)/);
 assert.ok(save.indexOf('if (invalidNumber)')<save.indexOf('const payload: any = {}'));
 assert.match(save,/if \(invalidNumber\) \{[\s\S]*?toast\.error\([\s\S]*?return;/);
});
test('bulk numeric edits reject non-finite values before mutation begins',()=>{
 const edit=between('const applyBulkEdit = async','return (');
 assert.match(edit,/if \(!Number\.isFinite\(v\)\)/);
 assert.ok(edit.indexOf('if (!Number.isFinite(v))')<edit.indexOf('setBulkEditSaving(true)'));
 assert.match(edit,/if \(!Number\.isFinite\(v\)\) \{[\s\S]*?toast\.error\([\s\S]*?return;/);
});
