// Static, deterministic replay manifest; does not execute SQL or authorize replay.
import {migrationReplayPreflight} from './migration-replay-preflight.mjs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export function buildReplayManifest(directory){
 const preflight=migrationReplayPreflight(directory);
 const files=preflight.ordered_migrations;
 const digest=createHash('sha256').update(files.map(x=>x.file+':'+x.sha256).join('\n')).digest('hex');
 const dependencyKinds=['auth_schema_fixture_required','storage_schema_fixture_required','security_definer_review_required','destructive_ddl_review_required','financial_side_effect_review_required'];
 const reviewQueue=preflight.blockers.filter(x=>dependencyKinds.includes(x.type)).map(x=>({review_type:x.type,files:x.files||[],reviewed:false}));
 return {
  status:'DRAFT_MANIFEST_NO_SQL_EXECUTION',
  repository_migrations:files.length,
  manifest_sha256:'sha256:'+digest,
  ordered_files:files,
  required_reviews:reviewQueue,
  fixture_requirements:['isolated_postgresql17','synthetic_auth_users','synthetic_role_claims','extension_dependency_review','synthetic_only_rows','financial_triggers_inactive'],
  replay_authorized:false,
  schema_equivalent:false,
  release_authorized:false
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node migration-replay-manifest.mjs supabase/migrations');
  console.log(JSON.stringify(buildReplayManifest(process.argv[2]),null,2));
 }catch(e){console.error('MANIFEST BLOCKED:',e.message);process.exitCode=1;}
}
