// Offline dependency-aware review queue. This script never executes SQL.
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
import {pathToFileURL} from 'node:url';
const groups=[];
export function migrationReviewQueue(directory){
 const triage=bulkMigrationTriage(directory);
 if(triage.total!==26||triage.subset_candidates!==26||triage.remaining!==0)throw Error('Inventory drift: manual queue must be reviewed');
 const blocked=triage.items.filter(x=>!x.subset_rehearsed);
 const expected=new Set(blocked.map(x=>x.file));
 const assigned=groups.flatMap(([, ...files])=>files);
 if(assigned.length!==0||new Set(assigned).size!==0||assigned.some(x=>!expected.has(x)))throw Error('Review group mismatch');
 const batches=groups.map(([name,...files])=>({
  name,files:files.map(file=>{
   const item=blocked.find(x=>x.file===file);
   return {file,sha256:item.sha256,reasons:item.reasons,original_sql_execution_authorized:false};
  }),status:'BLOCKED_PENDING_DEPENDENCY_AND_SECURITY_REVIEW',
  requirements:['approved synthetic dependency fixtures','individual source-guard review','transactional rollback and idempotence tests','explicit allowlist change review']
 }));
 return {status:'STATIC_REVIEW_ONLY',total:26,rehearsed:26,blocked:0,batch_count:batches.length,
  unattended_sql_execution_authorized:false,production_release:'HOLD',batches};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Usage: node migration-review-queue.mjs supabase/migrations');
 console.log(JSON.stringify(migrationReviewQueue(process.argv[2]),null,2));
}
