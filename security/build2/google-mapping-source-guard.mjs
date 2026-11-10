// Fail closed if original function source deviates from the reviewed shape.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const FILE='20260513123429_96eb00ba-85cc-4ea0-82f5-f72784d19773.sql';
export function validateMappingSource(dir){
 let sql;try{sql=readFileSync(join(dir,FILE),'utf8');}catch{return false;}
 const s=sql.replace(/--[^\n]*/g,'').trim().replace(/\s+/g,' ').toLowerCase();
 const prefix='create or replace function public.sync_google_integration_mapping() returns trigger language plpgsql set search_path = public as $$';
 const suffix='new.updated_at := now(); return new; end; $$;';
 if(!s.startsWith(prefix)||!s.endsWith(suffix))return false;
 if((s.match(/\$\$/g)||[]).length!==2)return false;
 if(/\b(security\s+definer|execute\s+format|drop\s+table|delete\s+from|truncate|grant|revoke|create\s+extension)\b/.test(s))return false;
 return (s.match(/\bnew\.mapping\b/g)||[]).length>=5
 &&(s.match(/\bnew\.column_mapping\b/g)||[]).length>=5
 &&s.includes("if tg_op = 'insert' then")
 &&s.includes("new.mapping is distinct from old.mapping")
 &&s.includes("new.column_mapping is distinct from old.column_mapping");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&validateMappingSource(process.argv[2]);console.log(ok?'PASS: mapping function source shape':'BLOCK: mapping function source changed');if(!ok)process.exitCode=1;
}
