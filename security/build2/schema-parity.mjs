// Offline-only schema parity comparison. Inputs must contain catalog metadata, never business rows.
// No database connection, network access, credentials or writes.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const SECTIONS=['tables','columns','constraints','indexes','views','functions','policies','triggers','grants'];
const keyFields={
 tables:['schema_name','object_name'],columns:['schema_name','table_name','column_name'],
 constraints:['schema_name','table_name','constraint_name'],indexes:['schema_name','table_name','index_name'],
 views:['schema_name','view_name'],functions:['schema_name','function_name','arguments'],
 policies:['schemaname','tablename','policyname'],triggers:['table_name','trigger_name'],
 grants:['schema_name','object_name','role_name']
};
export function compareSnapshots(expected,actual){
 const findings=[];
 for(const section of SECTIONS){
  const a=expected?.[section],b=actual?.[section];
  if(!Array.isArray(a)||!Array.isArray(b)){
   findings.push({section,type:'missing_section'});continue;
  }
  const index=(rows,side)=>{
   const map=new Map();
   for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row)){findings.push({section,type:'invalid_row',side});continue;}
    const keys=keyFields[section];
    if(keys.some(k=>typeof row[k]!=='string'||!row[k])){findings.push({section,type:'invalid_key',side});continue;}
    const key=keys.map(k=>row[k]).join('::');
    if(map.has(key))findings.push({section,type:'duplicate_key',side,key});
    map.set(key,JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))));
   }
   return map;
  };
  const left=index(a,'expected'),right=index(b,'actual');
  for(const [key,value] of left){
   if(!right.has(key))findings.push({section,type:'missing_object',key});
   else if(right.get(key)!==value)findings.push({section,type:'changed_definition',key});
  }
  for(const key of right.keys())if(!left.has(key))findings.push({section,type:'unexpected_object',key});
 }
 return {equal:findings.length===0,findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)throw Error('Usage: node schema-parity.mjs expected-metadata.json actual-metadata.json');
  const [expected,actual]=process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')));
  const result=compareSnapshots(expected,actual);
  console.log(JSON.stringify(result,null,2));
  if(!result.equal)process.exitCode=1;
 }catch(e){console.error('SCHEMA PARITY BLOCKED:',e.message);process.exitCode=1;}
}
