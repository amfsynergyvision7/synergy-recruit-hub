import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const board=readFileSync(new URL('../../src/components/CandidateBoard.tsx',import.meta.url),'utf8');
test('candidate board verifies returned UPDATE row before success toast',()=>{
 const handler=board.split('const moveCandidate = async')[1]?.split('\n  return (')[0];
 assert.ok(handler,'candidate stage update handler missing');
 assert.match(handler,/\.update\(\{ stage: newStage \}\)/);
 assert.match(handler,/\.eq\("id", candidateId\)/);
 assert.match(handler,/\.select\("id, stage"\)/);
 assert.match(handler,/\.maybeSingle\(\)/);
 assert.match(handler,/if \(error \|\| !data \|\| data\.stage !== newStage\)/);
 assert.ok(handler.indexOf('if (error || !confirmed')<handler.indexOf('toast.success('),'success must follow verified update');
 assert.match(handler,/await load\(\)/,'failed or zero-row update must restore authoritative state');
});
