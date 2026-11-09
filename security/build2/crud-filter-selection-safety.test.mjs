import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
test('changing search clears previous bulk selection',()=>{
 assert.match(source,/onChange=\{\(e\)=>\{ setSelected\(new Set\(\)\); setSearch\(e\.target\.value\); \}\}/);
});
test('changing or clearing column filters clears previous bulk selection',()=>{
 assert.match(source,/const setColumnFilter = \(name: string, value: string\) => \{\s*setSelected\(new Set\(\)\)/);
 assert.match(source,/onClick=\{\(\) => \{ setSelected\(new Set\(\)\); setColumnFilters\(\{\}\); \}\}/);
});
