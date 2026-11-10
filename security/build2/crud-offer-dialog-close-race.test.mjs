import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/components/CrudModule.tsx', import.meta.url), 'utf8');
test('closing the editor invalidates in-flight offer candidate lookup before updating dialog state', () => {
 assert.match(src, /<Dialog open=\{open\} onOpenChange=\{\(nextOpen\) => \{ if \(!nextOpen\) offerLookupSequence\.current\+\+; setOpen\(nextOpen\); \}\}>/);
});
test('stale offer results cannot update the form after dialog close', () => {
 const lookup = src.slice(src.indexOf('const handleFieldChange'), src.indexOf('const openCreate'));
 assert.match(lookup, /if \(sequence !== offerLookupSequence\.current\) return/);
 assert.match(lookup, /if \(sequence === offerLookupSequence\.current\)/);
});
