import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
test('candidate recruiter assignment hidden from non-admin form and bulk edit',()=>{
 assert.match(src,/table === "candidates" && f\.name === "assigned_recruiter" && role !== "admin"/);
 assert.match(src,/const bulkEditableFields = useMemo\(\(\) => formFields\.filter/);
});
test('single record updates only send changed fields',()=>{
 const save=src.slice(src.indexOf('const save = async'),src.indexOf('const remove = async'));
 assert.match(save,/if \(!editing \|\| String\(oldValue\) !== String\(v\)\) payload\[f\.name\] = v/);
 assert.match(save,/if \(Object\.keys\(payload\)\.length === 0\)/);
 assert.match(save,/form\.candidate_uuid !== editing\.candidate_uuid/);
 assert.match(save,/\.update\(payload\)\.eq\("id", editing\.id\)\.select\("id"\)/);
});
