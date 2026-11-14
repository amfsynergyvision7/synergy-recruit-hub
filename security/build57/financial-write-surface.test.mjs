import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
const paths=[];
function visit(path){
 for(const item of readdirSync(path,{withFileTypes:true})){
  const full=join(path,item.name);
  if(item.isDirectory()){if(item.name!=="ui")visit(full);continue;}
  if(/\.(ts|tsx)$/.test(item.name))paths.push(full);
 }
}
visit("src");
test("no source file contains direct literal billing-table DML",()=>{
 const findings=[];
 for(const path of paths){
  const s=readFileSync(path,"utf8");
  const pattern=/\.from\s*\(\s*['"`]billing['"`]\s*(?:as\s+any)?\s*\)/g;
  for(const match of s.matchAll(pattern)){
   // A bounded chain check: indirect dynamic table parameters are checked
   // independently via the CrudModule release hold source contract.
   const chunk=s.slice(match.index,match.index+450).split(";")[0];
   if(/\.(?:insert|update|upsert|delete)\s*\(/.test(chunk))
    findings.push(path+":"+s.slice(0,match.index).split("\n").length);
  }
 }
 assert.deepEqual(findings,[],
  "Unreviewed direct billing write path(s): "+findings.join(", "));
 assert.ok(paths.length>35,"Unexpected source inventory shrinkage");
});
test("generic billing table writer remains presentation held",()=>{
 const crud=readFileSync("src/components/CrudModule.tsx","utf8");
 const hold=readFileSync("src/lib/release-safety.ts","utf8");
 assert.match(crud,/billingMutationPaused = module === "billing" && LEGACY_BILLING_MUTATIONS_PAUSED/);
 for(const op of ["const save = async","const remove = async","const bulkDelete = async","const applyBulkEdit = async"]){
  const pos=crud.indexOf(op);
  assert.ok(pos>=0);
  assert.match(crud.slice(pos,pos+360),/if \(billingMutationPaused\)/);
 }
 assert.match(hold,/LEGACY_BILLING_MUTATIONS_PAUSED = true as const/);
});
