// Fail-closed SQL source allowlist for sixth disposable original-migration rehearsal.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const INDEX_MIGRATION='20260513114418_a73bb859-8580-44ae-aa31-0ea0a49fb6cb.sql';
export function validateIndexMigration(dir){
 let sql;try{sql=readFileSync(join(dir,INDEX_MIGRATION),'utf8');}catch{return false;}
 const normalized=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim().replace(/\s+/g,' ').replace(/;\s*$/,'').toLowerCase();
 return normalized==='create unique index if not exists google_integrations_only_one_settings_row on public.google_integrations ((true))';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&validateIndexMigration(process.argv[2]);console.log(ok?'PASS: exact unique index source contract':'BLOCK: unique index source contract changed');if(!ok)process.exitCode=1;
}
