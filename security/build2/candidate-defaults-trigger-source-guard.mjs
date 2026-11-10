import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const FILE='20260513114149_ef9683b0-d887-4e8d-bb05-5daedc4e6004.sql';
export function validateCandidateDefaultsTrigger(dir){
 let sql;try{sql=readFileSync(join(dir,FILE),'utf8');}catch{return false;}
 const s=sql.replace(/--[^\n]*/g,'').trim().replace(/\s+/g,' ').toLowerCase();
 return /^drop trigger if exists set_candidate_sync_defaults_trigger on public\.candidates; create trigger set_candidate_sync_defaults_trigger before insert on public\.candidates for each row execute function public\.set_candidate_sync_defaults\(\);$/.test(s);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&validateCandidateDefaultsTrigger(process.argv[2]);
 console.log(ok?'PASS: original candidate defaults trigger source strictly allowlisted':'BLOCK: source changed');
 if(!ok)process.exitCode=1;
}
