// Offline preflight only: never executes SQL, connects to a database, or writes migrations.
import {auditMigrationDirectory} from './migration-source-audit.mjs';
import {pathToFileURL} from 'node:url';
export function migrationReplayPreflight(directory){
 const audit=auditMigrationDirectory(directory);
 const blockers=[];
 if(audit.files!==26)blockers.push({type:'unexpected_migration_count',actual:audit.files});
 const ordered=audit.inventory.map(x=>x.file);
 if(new Set(ordered).size!==ordered.length)blockers.push({type:'duplicate_migration_filename'});
 const flags={
  auth_dependency:audit.inventory.filter(x=>x.indicators.references_auth).map(x=>x.file),
  storage_dependency:audit.inventory.filter(x=>x.indicators.references_storage).map(x=>x.file),
  privileged_function:audit.inventory.filter(x=>x.indicators.security_definer>0).map(x=>x.file),
  destructive_ddl:audit.inventory.filter(x=>x.indicators.drop_object>0).map(x=>x.file),
  financial_side_effect:audit.inventory.filter(x=>x.indicators.workflow_financial_terms).map(x=>x.file),
  dynamic_sql:audit.inventory.filter(x=>x.indicators.dynamic_sql).map(x=>x.file)
 };
 if(flags.auth_dependency.length)blockers.push({type:'auth_schema_fixture_required',files:flags.auth_dependency});
 if(flags.storage_dependency.length)blockers.push({type:'storage_schema_fixture_required',files:flags.storage_dependency});
 if(flags.privileged_function.length)blockers.push({type:'security_definer_review_required',files:flags.privileged_function});
 if(flags.destructive_ddl.length)blockers.push({type:'destructive_ddl_review_required',files:flags.destructive_ddl});
 if(flags.financial_side_effect.length)blockers.push({type:'financial_side_effect_review_required',files:flags.financial_side_effect});
 return {status:'PREFLIGHT_ONLY_NOT_EXECUTED',safe_to_replay_unattended:false,migration_count:audit.files,ordered_migrations:audit.inventory.map(x=>({file:x.file,sha256:x.sha256})),flags,blockers};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node migration-replay-preflight.mjs supabase/migrations');
  const result=migrationReplayPreflight(process.argv[2]);console.log(JSON.stringify(result,null,2));
  if(result.blockers.length)process.exitCode=2;
 }catch(e){console.error('MIGRATION REPLAY PREFLIGHT ERROR:',e.message);process.exitCode=1;}
}
