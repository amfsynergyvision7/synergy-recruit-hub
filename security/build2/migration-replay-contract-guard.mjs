// Offline replay safety contract; no SQL execution, no database access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateSafeColumnMigrations} from './safe-column-migration-guard.mjs';
export function validateReplayContract(config,directory){
 const issues=[];
 if(config?.environment!=='disposable')issues.push('non_disposable_environment');
 if(config?.fixture_type!=='synthetic')issues.push('non_synthetic_fixture');
 if(config?.network_access!==false)issues.push('network_must_be_disabled');
 if(config?.financial_workflows_enabled!==false)issues.push('financial_workflows_must_be_disabled');
 if(config?.allow_production_connections!==false)issues.push('production_connections_must_be_disabled');
 if(config?.migration_mode!=='allowlisted_subset_only')issues.push('unapproved_migration_mode');
 const guard=validateSafeColumnMigrations(directory);
 if(!guard.safe)issues.push(...guard.issues.map(x=>'sql:'+x));
 const expected=['20260927180000_job_requirements_field.sql','20260927200000_candidate_resume_summary.sql','20260927210000_resume_import_folder_setting.sql','20260929050000_app_settings_color_theme.sql','20260930100000_candidate_ats_score.sql'];
 if(!Array.isArray(config?.files)||JSON.stringify(config.files)!==JSON.stringify(expected))issues.push('file_order_or_scope_mismatch');
 return {ready_for_disposable_subset_replay:issues.length===0,issues,production_equivalent:false,release_authorized:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)throw Error('Usage: node migration-replay-contract-guard.mjs contract.json supabase/migrations');
  const result=validateReplayContract(JSON.parse(readFileSync(process.argv[2],'utf8')),process.argv[3]);
  console.log(JSON.stringify(result,null,2));if(!result.ready_for_disposable_subset_replay)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
