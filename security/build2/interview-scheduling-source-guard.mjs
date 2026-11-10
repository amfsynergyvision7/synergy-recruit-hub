// Strict source contract for isolated original interview scheduling migration.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const FILE='20260930050000_interview_scheduling_links.sql';
export function validateInterviewSchedulingSource(dir){
 let sql;try{sql=readFileSync(join(dir,FILE),'utf8');}catch{return false;}
 const normalized=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim().replace(/\s+/g,' ').toLowerCase();
 return normalized==="alter table public.interviews add column if not exists scheduling_token uuid, add column if not exists proposed_slots jsonb; create unique index if not exists interviews_scheduling_token_idx on public.interviews (scheduling_token);";
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&validateInterviewSchedulingSource(process.argv[2]);console.log(ok?'PASS: exact scheduling SQL source':'BLOCK: scheduling SQL source changed');if(!ok)process.exitCode=1;
}
