/**
 * Build147: advisory ONLY. Safe GitHub READ-ONLY release blocker summary.
 * No secrets, protected-environment credentials, external messages or writes.
 * A missing/forbidden API result is UNVERIFIED, never an approval.
 */
import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {
  EXPECTED_REPO,EXPECTED_PR,EXPECTED_BRANCH,
  EXPECTED_ACTOR,EXPECTED_ENVIRONMENT,verifyProtectedEnvironment,
  verifyMinimumEnforcedMainRules
} from './independent-release-approval.mjs';

export function summarizeReleaseBlockers({main,mainRules,pr,reviews,environment}={}){
 const rows=[];
 const check=(name,verdict)=>rows.push({name,verdict});
 check('Protected main',!main?'UNVERIFIED':
   main.name==='main'&&main.protected===true?'VERIFIED':
   'BLOCKED');
 let branchRulesVerdict='UNVERIFIED';
 if(mainRules!==null&&mainRules!==undefined){
  try{verifyMinimumEnforcedMainRules(mainRules);branchRulesVerdict='VERIFIED';}
  catch{branchRulesVerdict='BLOCKED';}
 }
 check('Active main PR/review/status/force-push rules',branchRulesVerdict);
 check('Isolated PR #15 source and state',!pr?'UNVERIFIED':
   pr.number===EXPECTED_PR&&pr.state==='open'&&pr.merged===false&&
   pr.head?.ref===EXPECTED_BRANCH&&
   pr.base?.ref==='main'&&pr.user?.login===EXPECTED_ACTOR&&
   typeof pr.head?.sha==='string'&&/^[a-f0-9]{40}$/.test(pr.head.sha)?
   'VERIFIED':'BLOCKED');
 const head=pr?.head?.sha??null;
 let reviewerVerdict='UNVERIFIED';
 if(pr&&Array.isArray(reviews)) {
   const decisions=new Map();
   for(const review of reviews){
     const name=review?.user?.login;
     if(!name||name===pr.user?.login||name.endsWith('[bot]')||
        !['OWNER','MEMBER','COLLABORATOR'].includes(review.author_association)||
        !['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state)||
        !Number.isFinite(Date.parse(review.submitted_at??'')))continue;
     const latest=decisions.get(name);
     if(!latest||Date.parse(latest.submitted_at)<=Date.parse(review.submitted_at))
       decisions.set(name,review);
   }
   const valid=[...decisions.values()];
   reviewerVerdict=valid.some(x=>x.state==='CHANGES_REQUESTED')?'BLOCKED':
     valid.some(x=>x.state==='APPROVED'&&x.commit_id===head)?'VERIFIED':'BLOCKED';
 }
 check('Independent approval at exact PR #15 SHA',reviewerVerdict);
 let environmentVerdict='UNVERIFIED';
 if(environment){
   try{verifyProtectedEnvironment(environment);environmentVerdict='VERIFIED';}
   catch{environmentVerdict='BLOCKED';}
 }
 check('Independently protected nonprod environment',environmentVerdict);
 const checked=rows.filter(x=>x.verdict==='VERIFIED').length;
 const blocked=rows.filter(x=>x.verdict==='BLOCKED').length;
 const unverified=rows.filter(x=>x.verdict==='UNVERIFIED').length;
 return Object.freeze({
   status:blocked>0?'HOLD':unverified>0?'UNVERIFIED':'OWNER_REVIEW_REQUIRED',
   head:typeof head==='string'&&/^[a-f0-9]{40}$/.test(head)?head:'UNVERIFIED',
   checked,blocked,unverified,rows
 });
}

async function readJson(path,token){
 const res=await fetch('https://api.github.com/repos/'+EXPECTED_REPO+path,{
   method:'GET',redirect:'error',
   headers:{
     Accept:'application/vnd.github+json',
     Authorization:'Bearer '+token,
     'X-GitHub-Api-Version':'2022-11-28',
     'User-Agent':'amf-nonprod-release-blocker-readonly'
   },signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw new Error('Read-only GitHub metadata unavailable');
 const body=await res.text();
 if(body.length>200000)throw new Error('Unexpected GitHub metadata response size');
 return JSON.parse(body);
}
export async function runReadonlyReleaseReport(env=process.env){
 const resources=[
  '/branches/main',
  '/rules/branches/main?per_page=100',
  '/pulls/'+EXPECTED_PR,
  '/pulls/'+EXPECTED_PR+'/reviews?per_page=100',
  '/environments/'+EXPECTED_ENVIRONMENT
 ];
 const token=env.GH_TOKEN;
 const responses=typeof token==='string'&&token.length>=20?
   await Promise.all(resources.map(path=>readJson(path,token).catch(()=>null))):
   [null,null,null,null,null];
 // A 100-item first page may be incomplete. Never mark either review or
 // branch-rules inventory VERIFIED on a possible partial response.
 if(Array.isArray(responses[1])&&responses[1].length>=100)responses[1]=null;
 if(Array.isArray(responses[3])&&responses[3].length>=100)responses[3]=null;
 const result=summarizeReleaseBlockers({
   main:responses[0],mainRules:responses[1],pr:responses[2],
   reviews:responses[3],environment:responses[4]
 });
 const summary=[
  '### Nonproduction Auth release gate: '+result.status,
  '',
  '**Advisory GitHub metadata only — NOT an authorization to merge, dispatch or deploy.**',
  'PR #15 HEAD: \`'+result.head+'\`',
  '',
  '| Control | Evidence |','|---|---|',
  ...result.rows.map(x=>'| '+x.name+' | '+x.verdict+' |'),
  '',
  'Verified: '+result.checked+'; blocked: '+result.blocked+
  '; unverified: '+result.unverified+'.',
  '',
  'Active rule checks are necessary but do not prove ruleset bypass actors.',
  'The read-only GitHub token cannot establish the full bypass_actor list;',
  'the repository administrator must inspect and separately attest those grants.',
  '',
  'Formal hosted UAT, production DB remediation, restore rehearsal and',
  'business/legal/finance signoffs are independent requirements.',
  ''
 ].join('\n');
 // No raw API payload, reviewer identities, account fields or secrets logged.
 process.stdout.write(summary+'\n');
 if(typeof env.GITHUB_STEP_SUMMARY==='string'&&
    env.GITHUB_STEP_SUMMARY.length>0)
   await appendFile(env.GITHUB_STEP_SUMMARY,summary+'\n');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runReadonlyReleaseReport().catch(()=>{
   process.stdout.write('NONPROD RELEASE STATUS UNVERIFIED: advisory audit unavailable. Release HOLD remains.\n');
 });
}
