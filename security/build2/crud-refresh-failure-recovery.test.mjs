import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const load=src.slice(src.indexOf('const load = async () =>'),src.indexOf('const loadRelations = async'));
test('CRM refresh always clears loading even when query rejects',()=>{
 assert.match(load,/try \{/);
 assert.match(load,/catch \(cause\)/);
 assert.match(load,/finally \{\s*if \(sequence === refreshSequence\.current\) setLoading\(false\)/);
 assert.match(load,/Could not refresh records\. Check your connection before retrying/);
});
test('failed CRM refresh does not replace prior rows with empty data',()=>{
 assert.match(load,/if \(error\) \{[\s\S]*?toast\.error/);
 assert.match(load,/\} else \{\s*const freshRows = \(data \|\| \[\]\) as any\[\];\s*setRows\(freshRows\)/);
 assert.ok(load.indexOf('setRows(freshRows)')<load.indexOf('catch (cause)'));
});
