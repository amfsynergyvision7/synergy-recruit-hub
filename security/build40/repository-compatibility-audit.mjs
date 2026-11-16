import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, extname, join } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('src');
const ext=new Set(['.ts','.tsx','.js','.jsx','.mjs']);
const allowedT=new Set(['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']);
const auditedFunctions=new Set(['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']);
const files=[];
function walk(dir) {
 for(const entry of readdirSync(dir,{withFileTypes:true})) {
   const p=join(dir,entry.name);
   if(entry.isDirectory() && !['node_modules','.git','dist'].includes(entry.name))walk(p);
   else if(entry.isFile() && ext.has(extname(p)))files.push(p);
 }
}
walk(root);
const fromPattern=/\.from\s*\(\s*(['"])([a-z][a-z_0-9]*)\1\s*\)/g;
const rpcPattern=/\.rpc\s*\(\s*(['"])([a-z][a-z_0-9]*)\1\s*[,)]/g;
const calls=[];const rpc=[];
for(const f of files){
 const code=readFileSync(f,'utf8');let match;
 while((match=fromPattern.exec(code))){
  const table=match[2];if(!allowedT.has(table))continue;
  const tail=code.slice(match.index+match[0].length,match.index+match[0].length+340);
  const op=(/\.(select|update|upsert|insert|delete)\s*\(/.exec(tail)||[])[1]||'unknown';
  const star=!!/\.select\s*\(\s*(['"])\*\1\s*\)/.exec(tail);
  calls.push({table,op,star,file:relative('.',f),line:code.slice(0,match.index).split('\n').length});
 }
 while((match=rpcPattern.exec(code))){
  if(!auditedFunctions.has(match[2]))continue;
  rpc.push({name:match[2],file:relative('.',f),line:code.slice(0,match.index).split('\n').length});
 }
}
const groups={};
for(const r of calls){groups[r.table]??={calls:0,writes:0,selectStar:0};groups[r.table].calls++;if(['update','upsert','insert','delete'].includes(r.op))groups[r.table].writes++;if(r.star)groups[r.table].selectStar++;}
const highRisk=calls.filter(x=>x.table==='app_settings'||(['candidates','job_openings','notifications'].includes(x.table)&&['update','upsert'].includes(x.op)));
assert.ok(files.length>0,'No application source found');
const result={status:'REVIEW_REQUIRED_NOT_RELEASE_APPROVAL',sourceFilesScanned:files.length,recognizedCalls:calls.length,recognizedRpcCalls:rpc.length,tableGroups:groups,highRiskCallsites:highRisk.slice(0,150),rpc};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
process.stdout.write('NOTE: Literal-call scan excludes dynamic queries, template literals, actual identities, and runtime permission compatibility.\n');
