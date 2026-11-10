// Classify all 26 migration files in one offline pass. Does not execute SQL.
import {auditMigrationDirectory} from './migration-source-audit.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const approvedSubset=['20260927180000_job_requirements_field.sql','20260927200000_candidate_resume_summary.sql','20260927210000_resume_import_folder_setting.sql','20260929050000_app_settings_color_theme.sql','20260930100000_candidate_ats_score.sql'];
export function bulkMigrationTriage(directory){
 const audit=auditMigrationDirectory(directory);
 const items=audit.inventory.map(x=>{
  const sql=readFileSync(join(directory,x.file),'utf8');
  const reasons=[];
  if(x.indicators.references_auth)reasons.push('auth_dependency');
  if(x.indicators.references_storage)reasons.push('storage_dependency');
  if(x.indicators.security_definer)reasons.push('privileged_function');
  if(x.indicators.drop_object)reasons.push('destructive_ddl');
  if(x.indicators.workflow_financial_terms)reasons.push('financial_workflow_review');
  if(x.indicators.dynamic_sql)reasons.push('dynamic_sql_review');
  if(/\bCREATE\s+EXTENSION\b/i.test(sql))reasons.push('extension_dependency');
  if(/\b(?:CREATE|ALTER)\s+(?:TABLE|FUNCTION|POLICY|TRIGGER|VIEW)\b/i.test(sql))reasons.push('schema_or_privilege_review');
  if(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(sql))reasons.push('data_side_effect_review');
  const rehearsed=approvedSubset.includes(x.file);
  return {file:x.file,sha256:x.sha256,bytes:x.bytes,subset_rehearsed:rehearsed,classification:rehearsed?'verified_subset_candidate':'manual_dependency_review_required',reasons:[...new Set(reasons)],unattended_full_replay_authorized:false};
 });
 return {status:'BULK_STATIC_TRIAGE_NOT_EXECUTION',total:items.length,subset_candidates:items.filter(x=>x.subset_rehearsed).length,remaining:items.filter(x=>!x.subset_rehearsed).length,all_26_replay_verified:false,source_equivalence_verified:false,items};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node bulk-migration-triage.mjs supabase/migrations');
  const result=bulkMigrationTriage(process.argv[2]);console.log(JSON.stringify(result,null,2));
  if(result.total!==26||result.subset_candidates!==5)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
