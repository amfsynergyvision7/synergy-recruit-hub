import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const expected={
 '20260517055116_3d1873db-f213-4a74-ae5e-7ea60e86a001.sql':'',
 '20260517055343_d3ca28ec-df58-4b32-ba79-cdc2aedc2157.sql':''
};
export function verifyPolicySources(dir){
 return Object.entries(expected).every(([name,digest])=>{
  try{return createHash('sha256').update(readFileSync(join(dir,name))).digest('hex')===digest;}catch{return false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&verifyPolicySources(process.argv[2]);
 console.log(ok?'PASS: both original RLS policy migrations match pinned source hashes':'BLOCK: RLS source changed');
 if(!ok)process.exitCode=1;
}
