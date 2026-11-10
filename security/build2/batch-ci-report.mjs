// Consolidated read-only CI report. No database or network access.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {bulkMigrationTriage} from './bulk-migration-triage.mjs';
export function makeBatchReport({triage,release,jobResults,sha,runId}){
 const jobs=['application-typescript-check','offline-security-tests','isolated-postgres-view-rls'];
 const results=Object.fromEntries(jobs.map(k=>[k,jobResults[k]??'unknown']));
 const gates=Object.entries(release);
 if(gates.length!==9||gates.some(([,v])=>v?.passed!==false))throw Error('HOLD invariant violated: all nine release gates must remain false');
 if(triage.total!==26||triage.subset_candidates!==25||triage.remaining!==1||triage.all_26_replay_verified!==false)throw Error('Unexpected migration inventory or subset count');
 const allGreen=jobs.every(k=>results[k]==='success');
 const report={
  status:'HOLD',release_authorized:false,production_equivalent:false,
  verification:allGreen?'DISPOSABLE_CI_JOBS_PASSED':'NOT_VERIFIED',
  commit:sha||'unknown',workflow_run_id:runId||'unknown',
  migration_inventory:26,disposable_replay_candidates:25,
  ci_verified_replays:allGreen?25:0,
  remaining_manual_dependency_review:1,
  authorization_scenarios_executed:0,authorization_scenarios_planned:140,
  release_gates_passed:0,release_gates_total:9,
  ci_jobs:results,
  replay_caveats:['Two original RLS policy migrations pass first application only; repeated application fails on existing CREATE POLICY and is not release-ready','Configurable workflow rules and reminder migrations are first-application-only in this fixture','Reminder SQL used an inert cron.schedule adapter: actual pg_cron execution is not verified','Financial and notification side effects were synthetic only; no operational automation was activated','Original baseline has a hardcoded privileged bootstrap identity exception requiring remediation','Original relationship backfill contains ambiguous multi-match joins and active financial triggers requiring independent review','pg_cron and pg_net extension installation is the sole unverified original migration'],
  rehearsed_files:triage.items.filter(x=>x.subset_rehearsed).map(x=>x.file).sort(),
  blocked_files:triage.items.filter(x=>!x.subset_rehearsed).map(x=>({file:x.file,reasons:x.reasons.length?x.reasons:['manual_review_required']})),
  note:'Twenty-five original migrations were rehearsed only in disposable synthetic PostgreSQL. Reminder cron.schedule was an inert adapter; no live schedule activated. No full-schema equivalence or production release is implied.'
 };
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==5)throw Error('Usage: node batch-ci-report.mjs migration-directory release-evidence.json output.json');
 const triage=bulkMigrationTriage(process.argv[2]);
 const release=JSON.parse(readFileSync(process.argv[3],'utf8'));
 const report=makeBatchReport({triage,release,jobResults:{
  'application-typescript-check':process.env.BUILD2_APP_RESULT,
  'offline-security-tests':process.env.BUILD2_OFFLINE_RESULT,
  'isolated-postgres-view-rls':process.env.BUILD2_PG_RESULT
 },sha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID});
 writeFileSync(process.argv[4],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,verification:report.verification,verified:report.ci_verified_replays,blocked:report.remaining_manual_dependency_review}));
 if(report.verification!=='DISPOSABLE_CI_JOBS_PASSED')process.exitCode=1;
}
