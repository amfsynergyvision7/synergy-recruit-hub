import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/components/CrudModule.tsx',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('const handleFieldChange = async'),source.indexOf('const openCreate ='));
test('offer lookup cannot overwrite changed candidate or intervening user edits',()=>{
 assert.match(source,/const offerLookupSequence = useRef\(0\)/);
 assert.match(handler,/if \(name === "candidate_uuid"\) offerLookupSequence\.current\+\+/);
 assert.match(handler,/if \(sequence !== offerLookupSequence\.current\) return/);
 assert.match(handler,/setForm\(\(previous: any\) => \{/);
 assert.match(handler,/if \(previous\.candidate_uuid !== value\) return previous/);
});
test('offer lookup failures are visible and forms invalidate old lookups',()=>{
 assert.match(handler,/if \(interviewResult\.error\) throw interviewResult\.error/);
 assert.match(handler,/if \(submissionResult\.error\) throw submissionResult\.error/);
 assert.match(handler,/Could not load related offer details/);
 assert.match(source,/const openCreate = \(\) => \{\s*offerLookupSequence\.current\+\+/);
 assert.match(source,/const openEdit = \(row: any\) => \{ offerLookupSequence\.current\+\+/);
});
