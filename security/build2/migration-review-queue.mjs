// Offline dependency-aware review queue. This script never executes SQL.
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
import {pathToFileURL} from 'node:url';
const groups=[
 ['baseline_schema','20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql'],
 ['relationship_backfill','20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f.sql'],
 ['extension_dependencies','20260513101842_cb1bc9ab-e5f4-4b42-b09a-60588844ca6c.sql']
];
export function migrationReviewQueue(directory){
 const triage=bulkMigrationTriage(directory);
 if(triage.total!==26||triage.subset_candidates!==23||triage.remaining!==3)throw Error('Inventory drift: manual queue must be reviewed');
 const blocked=triage.items.filter(x=>!x.subset_rehearsed);
 const expected=new Set(blocked.map(x=>x.file));
 const assigned=groups.flatMap(([, ...files])=>files);
 if(assigned.length!==3||new Set(assigned).size!==3||assigned.some(x=>!expected.has(x)))throw Error('Review group mismatch');
 const batches=groups.map(([name,...files])=>({
  name,files:files.map(file=>{
   const item=blocked.find(x=>x.file===file);
   return {file,sha256:item.sha256,reasons:item.reasons,original_sql_execution_authorized:false};
  }),status:'BLOCKED_PENDING_DEPENDENCY_AND_SECURITY_REVIEW',
  requirements:['approved synthetic dependency fixtures','individual source-guard review','transactional rollback and idempotence tests','explicit allowlist change review']
 }));
 return {status:'STATIC_REVIEW_ONLY',total:26,rehearsed:23,blocked:3,batch_count:batches.length,
  unattended_sql_execution_authorized:false,production_release:'HOLD',batches};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Usage: node migration-review-queue.mjs supabase/migrations');
 console.log(JSON.stringify(migrationReviewQueue(process.argv[2]),null,2));
}
