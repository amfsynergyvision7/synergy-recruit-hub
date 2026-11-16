/**
 * Build190 review-only read of TWO pinned Git source trees, not a runtime
 * authorization proof. Run in disposable GitHub CI using read-only git.
 *
 * Does NOT access Supabase, GitHub API, company files, secret values or rows.
 * All results are line-location identifiers from already committed code.
 */
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

const snapshots=[
 {label:'main',sha:'c735292fbace6605d691a68b602a02b2c6f9e137',
  remoteRef:'refs/remotes/origin/build190-main'},
 {label:'integration',sha:'b2734b14c0e19d2ce2b8daa87655ca18c2d932d6',
  remoteRef:'refs/remotes/origin/build190-integration'}
];
const get=(args,maxBuffer=8*1024*1024)=>execFileSync('git',args,{
 encoding:'utf8',maxBuffer,stdio:['ignore','pipe','pipe']
}).trimEnd();
const patterns=[
 {name:'has_role_call_or_literal',regex:/\b(?:public\s*\.\s*)?has_role\s*\(|\brpc\s*\(\s*["'\x60]has_role["'\x60]/g},
 {name:'direct_user_roles_client',regex:/\.from\s*\(\s*["'\x60]user_roles["'\x60]\s*\)/g},
 {name:'direct_audit_logs_client',regex:/\.from\s*\(\s*["'\x60]audit_logs["'\x60]\s*\)/g},
 {name:'direct_user_roles_mutation',regex:/\.from\s*\(\s*["'\x60]user_roles["'\x60]\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/g},
 {name:'direct_audit_logs_mutation',regex:/\.from\s*\(\s*["'\x60]audit_logs["'\x60]\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/g},
 {name:'audit_logs_mentions',regex:/\baudit_logs\b/g},
 {name:'user_roles_mentions',regex:/\buser_roles\b/g},
 {name:'trusted_email_rpc_mentions',regex:/\bcrm_email_confirm_sent_trusted\b/g},
 {name:'dynamic_rpc_candidates',regex:/\.rpc\s*\(\s*(?!["'\x60])\w+/g}
];
const allowed=path=>(
 /^(src\/|supabase\/functions\/|supabase\/migrations\/|api\/|server\/)/.test(path)
 && /\.(?:ts|tsx|js|jsx|mjs|cjs|sql)$/.test(path)
);
const sourceKind=path=>(path.startsWith('supabase/migrations/')?'migration':'runtime');
const releases=[];
for(const snapshot of snapshots){
 const observed=get(['rev-parse',snapshot.remoteRef]);
 assert.equal(observed,snapshot.sha,
  'Source branch drift: do not claim pinned inventory after upstream branch changes');
 const paths=get(['ls-tree','-r','--name-only',snapshot.sha]).split('\n').filter(allowed).sort();
 assert(paths.length>=60,'Source inventory is unexpectedly small: '+snapshot.label);
 const findings=[];let bytesScanned=0;
 for(const file of paths){
  const contents=execFileSync('git',['show',snapshot.sha+':'+file],{
   encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']
  });
  bytesScanned+=Buffer.byteLength(contents);
  const lines=contents.split('\n'),kind=sourceKind(file);
  for(const rule of patterns){
   rule.regex.lastIndex=0;
   for(const match of contents.matchAll(rule.regex)){
    const index=match.index??0;
    const line=contents.slice(0,index).split('\n').length;
    // No secret values, full files or nearby unrelated code is printed;
    // include only classification and source location. Reviewers open Git.
    findings.push({source:snapshot.label,path:file,line,kind,tag:rule.name});
   }
  }
 }
 const counts=Object.fromEntries(patterns.map(p=>[p.name,findings.filter(f=>f.tag===p.name).length]));
 const runtimeCounts=Object.fromEntries(patterns.map(p=>[p.name,findings.filter(f=>f.kind==='runtime'&&f.tag===p.name).length]));
 const runtime=paths.filter(p=>sourceKind(p)==='runtime').length;
 const migration=paths.length-runtime;
 releases.push({
  source:snapshot.label,sha:snapshot.sha,tracked_files:paths.length,
  runtime_files:runtime,migrations:migration,bytesScanned,
  counts,runtimeCounts,findings:findings.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line||a.tag.localeCompare(b.tag))
 });
}
const report={
 evidenceType:'STATIC_SOURCE_ONLY_NO_EXTERNAL_OR_DYNAMIC_CALLER_CLEARANCE',
 repository:'amfsynergyvision7/synergy-recruit-hub',
 generatedFrom:'TWO_PINNED_GIT_BRANCH_HEADS_AS_OF_BUILD190',
 sourceTrees:releases,
 conclusion:'REVIEW_ONLY_CHECK_ALL_STATIC_APP_AND_MIGRATION_MATCHES_NOT_A_DEPLOYMENT_AUTHORIZATION'
};
assert(releases.length===2);
const total= releases.reduce((n,r)=>n+r.tracked_files,0);
assert(total>130,'Failed to scan enough repository source files');
const reportPath=join(process.env.RUNNER_TEMP||'/tmp','build190-source-inventory.json');
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
for(const release of releases){
 console.log('BUILD190_SOURCE_SCAN '+release.source+' sha='+release.sha+
  ' scanned='+release.tracked_files+' runtime='+release.runtime_files+
  ' migrations='+release.migrations+' counts='+JSON.stringify(release.counts)+' runtimeCounts='+JSON.stringify(release.runtimeCounts));
 for(const f of release.findings.filter(x=>[
  'has_role_call_or_literal','direct_user_roles_client','direct_audit_logs_client',
  'direct_user_roles_mutation','direct_audit_logs_mutation',
  'trusted_email_rpc_mentions','dynamic_rpc_candidates'
 ].includes(x.tag))){
  console.log('BUILD190_REVIEW_MATCH '+f.source+' '+f.kind+' '+f.tag+
   ' '+f.path+':'+f.line);
 }
}
console.log('BUILD190_SOURCE_SCAN_REPORT '+reportPath);
console.log('BUILD190_STATIC_INVENTORY_COMPLETE_NOT_RELEASE_OR_EXTERNAL_CALLER_CLEAN');
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary){
 const {appendFileSync}=await import('node:fs');
 appendFileSync(summary,'### Build190 pinned application/database source caller inventory\n\n'+
 '| Snapshot | Source files | Runtime files | Migrations | Direct role-table calls | Direct audit-table calls | Role-helper matches |\n'+
 '|---|---:|---:|---:|---:|---:|---:|\n'+
 releases.map(v=>'| '+v.source+' | '+v.tracked_files+' | '+v.runtime_files+
  ' | '+v.migrations+' | '+v.counts.direct_user_roles_client+
  ' | '+v.counts.direct_audit_logs_client+' | '+v.runtimeCounts.has_role_call_or_literal+' |').join('\n')+
 '\n\n**Review-only source scan:** pinned Git trees; not complete external/dynamic caller or runtime proof. Full source locations appear in logs and the runner-local JSON evidence.\n');
}
