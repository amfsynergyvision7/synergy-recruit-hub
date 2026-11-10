import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const load=source.slice(source.indexOf('const load = async () =>'),source.indexOf('const loadRelations = async'));
test('CRM refresh sequence rejects superseded responses and cleanup invalidates pending refreshes',()=>{
 assert.match(source,/useRef\(0\)/);
 assert.match(load,/const sequence = \+\+refreshSequence\.current/);
 assert.match(load,/if \(sequence !== refreshSequence\.current\) return/);
 assert.match(load,/if \(sequence === refreshSequence\.current\) setLoading\(false\)/);
 assert.match(source,/return \(\) => \{ refreshSequence\.current\+\+; relationSequence\.current\+\+; offerLookupSequence\.current\+\+; supabase\.removeChannel\(ch\); \}/);
});
test('successful CRM refresh removes selected IDs absent from returned records',()=>{
 assert.match(load,/const freshRows = \(data \|\| \[\]\) as any\[\]/);
 assert.match(load,/const visibleIds = new Set\(freshRows\.map\(\(row\) => row\.id\)\)/);
 assert.match(load,/setSelected\(\(previous\) => new Set\(\[\.\.\.previous\]\.filter\(\(id\) => visibleIds\.has\(id\)\)\)\)/);
 assert.ok(load.indexOf('if (sequence !== refreshSequence.current) return')<load.indexOf('setRows(freshRows)'));
});
