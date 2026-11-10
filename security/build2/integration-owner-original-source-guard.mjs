import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
// Source fingerprint avoids duplicating personal contact information in the original SQL.
const expectedFNV=2009264869;
function fnv32(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;}
export function verifyOwnerBackfillSource(dir){try{return fnv32(readFileSync(join(dir,'20260513120653_866325d2-3efd-4d67-be04-266cfec6243d.sql'),'utf8'))===expectedFNV;}catch{return false;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const ok=process.argv.length===3&&verifyOwnerBackfillSource(process.argv[2]);console.log(ok?'PASS: original owner backfill source pinned':'BLOCK: original owner backfill source drift');if(!ok)process.exitCode=1;}
