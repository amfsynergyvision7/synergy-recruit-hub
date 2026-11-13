/**
 * Build88: enforce genuine independent PR review AND protected main for any
 * privileged hosted nonproduction Auth user/fixture write.
 * No Supabase secret is available to this step. Only read-only GitHub API GET.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const EXPECTED_REPO='amfsynergyvision7/synergy-recruit-hub';
export const EXPECTED_PR=15;
export const EXPECTED_BRANCH='release/nonprod-auth-uat-gate-20261113';
export const EXPECTED_ACTOR='amfsynergyvision7';

export function verifyIndependentReleaseGate({pr,reviews,main,context}){
 if(context?.repository!==EXPECTED_REPO||
    context?.eventName!=='workflow_dispatch'||
    context?.ref!=='refs/heads/main'||
    context?.actor!==EXPECTED_ACTOR||
    !/^[a-f0-9]{40}$/.test(context.sha??'')) {
   throw new Error('Trusted manual repository/actor/ref context is absent');
 }
 if(!main?.protected||main?.name!=='main'||
    main?.commit?.sha!==context.sha)
   throw new Error('Main branch must be protected and unmodified since manual dispatch');
 if(pr?.number!==EXPECTED_PR||pr?.merged!==true||pr?.state!=='closed'||
    pr?.base?.ref!=='main'||pr?.head?.ref!==EXPECTED_BRANCH||
    pr?.user?.login!==EXPECTED_ACTOR||
    !/^[a-f0-9]{40}$/.test(pr?.head?.sha??'')) {
   throw new Error('Pinned isolated Auth bootstrap PR must be independently merged');
 }
 if(!Array.isArray(reviews)||reviews.length===0||reviews.length>=100)
   throw new Error('Independent PR review inventory is missing or incomplete');
 const lastDecision=new Map();
 for(const r of reviews){
   const name=r?.user?.login;
   if(typeof name!=='string'||!name||name===pr.user.login||
      name.endsWith('[bot]')||
      !['OWNER','MEMBER','COLLABORATOR'].includes(r.author_association))continue;
   if(!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r?.state))continue;
   if(!Number.isFinite(Date.parse(r?.submitted_at??'')))
     throw new Error('Invalid independent reviewer timeline');
   const old=lastDecision.get(name);
   if(!old||Date.parse(old.submitted_at)<=Date.parse(r.submitted_at))
     lastDecision.set(name,r);
 }
 const valid=[...lastDecision.values()].some(r=>
   r.state==='APPROVED'&&r.commit_id===pr.head.sha);
 if(!valid)throw new Error('Fresh independent review approving exact Auth bootstrap SHA required');
 return {independentApproved:true,protectedMain:true,approvedPr:EXPECTED_PR};
}

async function getGitHubJson(path,token){
 const url='https://api.github.com/repos/'+EXPECTED_REPO+path;
 const res=await fetch(url,{
   method:'GET',redirect:'error',
   headers:{
     Accept:'application/vnd.github+json',
     Authorization:'Bearer '+token,
     'X-GitHub-Api-Version':'2022-11-28',
     'User-Agent':'amf-nonprod-auth-release-gate'
   },
   signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw new Error('Required protected GitHub review state unavailable');
 const body=await res.text();
 if(body.length>1200000)throw new Error('Unexpected GitHub review response size');
 return JSON.parse(body);
}
export async function assertGitHubReleaseGate(env=process.env){
 const token=env.GH_TOKEN;
 if(typeof token!=='string'||token.length<20)
   throw new Error('Read-only GitHub review token missing');
 const context={
   repository:env.GITHUB_REPOSITORY,
   eventName:env.GITHUB_EVENT_NAME,
   ref:env.GITHUB_REF,
   actor:env.GITHUB_ACTOR,
   sha:env.GITHUB_SHA
 };
 // Bound, exact read-only API URLs; no GitHub writes or Supabase access.
 const [pr,reviews,main]=await Promise.all([
   getGitHubJson('/pulls/'+EXPECTED_PR,token),
   getGitHubJson('/pulls/'+EXPECTED_PR+'/reviews?per_page=100',token),
   getGitHubJson('/branches/main',token)
 ]);
 return verifyIndependentReleaseGate({pr,reviews,main,context});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assertGitHubReleaseGate().then(()=>{
   process.stdout.write('INDEPENDENT_GITHUB_REVIEW_AND_MAIN_PROTECTION_PASS: No secrets inspected; nonprod credential step still separate.\n');
 }).catch(()=>{
   process.stderr.write('NONPROD_AUTH_WRITE_HOLD: Require protected main and independent APPROVED review at exact bootstrap SHA. No credentials accessed.\n');
   process.exitCode=1;
 });
}
