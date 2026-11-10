import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const relations=src.slice(src.indexOf('const loadRelations = async'),src.indexOf('useEffect(() =>'));
test('relation lookup responses cannot overwrite newer responses',()=>{
 assert.match(src,/const relationSequence = useRef\(0\)/);
 assert.match(relations,/const sequence = \+\+relationSequence\.current/);
 assert.match(relations,/if \(sequence === relationSequence\.current\) setRelationOptions/);
 assert.match(src,/relationSequence\.current\+\+; offerLookupSequence\.current\+\+; supabase\.removeChannel/);
});
test('relation query errors are not silently replaced with empty options',()=>{
 assert.match(relations,/if \(error\) throw error/);
 assert.match(relations,/catch \(cause\)/);
 assert.match(relations,/Could not refresh related options/);
});
