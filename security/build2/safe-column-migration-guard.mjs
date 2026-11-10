// Fail-closed allowlist for the three disposable replay migrations. No SQL execution.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const ALLOW={
 '20260927180000_job_requirements_field.sql':['job_openings.requirements:text'],
 '20260927200000_candidate_resume_summary.sql':['candidates.resume_summary:text'],
 '20260930100000_candidate_ats_score.sql':['candidates.ats_score:integer','candidates.ats_issues:jsonb','candidates.ats_checked_at:timestamptz']
};
export function validateSafeColumnMigrations(directory){
 const issues=[],columns=[];
 for(const [file,expected] of Object.entries(ALLOW)){
  let sql;
  try{sql=readFileSync(join(directory,file),'utf8');}catch{issues.push(file+':missing');continue;}
  const stripped=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
  const statements=stripped.split(';').map(x=>x.trim()).filter(Boolean);
  const found=[];
  for(const statement of statements){
   const match=/^ALTER\s+TABLE\s+public\.(candidates|job_openings)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([a-z_]+)\s+(TEXT|INTEGER|JSONB|TIMESTAMPTZ)$/i.exec(statement);
   if(!match){issues.push(file+':non_allowlisted_statement');continue;}
   found.push(match[1].toLowerCase()+'.'+match[2].toLowerCase()+':'+match[3].toLowerCase());
  }
  if(JSON.stringify(found)!==JSON.stringify(expected))issues.push(file+':column_contract_mismatch');
  columns.push(...found);
 }
 return {safe:issues.length===0,issues,columns,files:Object.keys(ALLOW).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node safe-column-migration-guard.mjs supabase/migrations');
  const result=validateSafeColumnMigrations(process.argv[2]);console.log(JSON.stringify(result,null,2));
  if(!result.safe)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
