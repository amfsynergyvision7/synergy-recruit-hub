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

/**
 * Build148: protected=true alone does not prove independent reviews or
 * substantive checks. Effective branch rules from GitHub GET
 * /rules/branches/main omit disabled and evaluate-only rulesets.
 */
/**
 * Build149: a required arbitrary green/decorative check does not mean the
 * repository requires the real no-secret isolated security contract job.
 * Accept the GitHub check context as either the job name or its workflow-
 * qualified spelling. Do not accept a generic/empty status as evidence.
 */
export const REQUIRED_NONPROD_CONTRACT_CHECKS=Object.freeze([
 'Nonprod Auth runner contracts — no secrets',
 'Nonprod Synthetic Auth UAT — Manual Only / Nonprod Auth runner contracts — no secrets'
]);
export function verifyMinimumEnforcedMainRules(rules){
 if(!Array.isArray(rules)||rules.length===0||rules.length>=100)
  throw new Error('Complete active main rules inventory unavailable');
 const byType=type=>rules.filter(r=>r?.type===type);
 const validPr=byType('pull_request').some(rule=>{
  const p=rule?.parameters;
  return Number.isInteger(p?.required_approving_review_count)&&
   p.required_approving_review_count>=1&&
   p.dismiss_stale_reviews_on_push===true&&
   p.require_last_push_approval===true&&
   p.required_review_thread_resolution===true;
 });
 const validChecks=byType('required_status_checks').some(rule=>{
  const checks=rule?.parameters?.required_status_checks;
  return Array.isArray(checks)&&checks.length>0&&checks.length<100&&
   checks.every(c=>typeof c?.context==='string'&&c.context.trim()!==''&&
    c.context!=='production-release-hold')&&
   checks.some(c=>REQUIRED_NONPROD_CONTRACT_CHECKS.includes(c.context));
 });
 if(!validPr||!validChecks||
    byType('non_fast_forward').length===0||
    byType('deletion').length===0)
  throw new Error('Active main rules lack reviews, checks, no-force-push or deletion protection');
 return Object.freeze({reviewRule:true,statusChecks:true,forcePushBlocked:true,deletionBlocked:true});
}

export function verifyIndependentReleaseGate({pr,reviews,main,context,mainRules}){
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
 verifyMinimumEnforcedMainRules(mainRules);
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
 const decisions=[...lastDecision.values()];
 // One collaborator's outstanding change request must not be overridden by
 // another collaborator's approval. Every blocking reviewer must resolve it.
 if(decisions.some(r=>r.state==='CHANGES_REQUESTED'))
   throw new Error('Outstanding independent changes-requested review blocks Auth writes');
 const valid=decisions.some(r=>
   r.state==='APPROVED'&&r.commit_id===pr.head.sha);
 if(!valid)throw new Error('Fresh independent review approving exact Auth bootstrap SHA required');
 return {independentApproved:true,protectedMain:true,approvedPr:EXPECTED_PR};
}


/**
 * Build90: prior PR approval cannot authorize later changes to executable
 * bootstrap source, dependency locks, workflow or release evidence.
 * This read-only SHA comparison runs before the step with lab credentials.
 */
export const PINNED_RELEASE_PATHS=Object.freeze([
  "package.json",
  "package-lock.json",
  ".github/workflows/nonprod-synthetic-auth-uat.yml",
  "security/nonprod-auth-uat/README.md",
  "security/nonprod-auth-uat/build88-hosted-preflight.readonly.sql",
  "security/nonprod-auth-uat/build88-live-preflight-observation.json",
  "security/nonprod-auth-uat/build89-hosted-preseed-two-hardenings.readonly.sql",
  "security/nonprod-auth-uat/build89-live-hardened-preseed-observation.json",
  "security/nonprod-auth-uat/build92-hosted-schema-contract.readonly.sql",
  "security/nonprod-auth-uat/build92-hosted-schema-observation.json",
  "security/nonprod-auth-uat/compose-and-seed-remaining-fixture.mjs",
  "security/nonprod-auth-uat/independent-release-approval.mjs",
  "security/nonprod-auth-uat/release-blocker-report.mjs",
  "security/nonprod-auth-uat/provision-nine-auth-users.mjs",
  "security/nonprod-auth-uat/release-gate.test.mjs",
  "security/nonprod-auth-uat/run-once.mjs",
  "security/nonprod-auth-uat/seed-inert-base-fixture.mjs"
]);
export function verifyPinnedReviewedSource(approvedTree,currentTree){
 if(approvedTree?.truncated!==false||currentTree?.truncated!==false||
    !Array.isArray(approvedTree.tree)||!Array.isArray(currentTree.tree))
   throw new Error('Complete approved and deployed Git trees required');
 const extract=tree=>{
   const found=new Map();
   for(const item of tree.tree){
     if(!PINNED_RELEASE_PATHS.includes(item?.path))continue;
     if(found.has(item.path)||item.type!=='blob'||
        !/^[a-f0-9]{40}$/.test(item.sha??''))
       throw new Error('Malformed reviewed release source inventory');
     found.set(item.path,item.sha);
   }
   return found;
 };
 const approved=extract(approvedTree),running=extract(currentTree);
 for(const path of PINNED_RELEASE_PATHS){
   if(!approved.has(path)||!running.has(path)||approved.get(path)!==running.get(path))
     throw new Error('Unreviewed change or missing release source file: '+path);
 }
 return {reviewedSourceFiles:PINNED_RELEASE_PATHS.length};
}


/**
 * Build91: never trust an environment name alone as an approval boundary.
 * Verify GitHub has actually enabled reviewer enforcement, self-review
 * prevention and protected-branch-only access for the lab environment.
 */
export const EXPECTED_ENVIRONMENT='amf-nonprod-auth-review';
export function verifyProtectedEnvironment(env){
 if(env?.name!==EXPECTED_ENVIRONMENT||!Array.isArray(env.protection_rules))
  throw new Error('Protected lab environment metadata is unavailable');
 const required=env.protection_rules.filter(x=>x?.type==='required_reviewers');
 if(required.length!==1||required[0].prevent_self_review!==true||
    !Array.isArray(required[0].reviewers)||required[0].reviewers.length===0)
  throw new Error('Lab environment must require independent reviewer approval and prevent self-review');
 const eligible=required[0].reviewers.some(x=>
  (x?.type==='User'&&typeof x.reviewer?.login==='string'&&
   x.reviewer.login!==EXPECTED_ACTOR&&!x.reviewer.login.endsWith('[bot]'))||
  (x?.type==='Team'&&typeof x.reviewer?.slug==='string'&&x.reviewer.slug.length>0));
 if(!eligible)
  throw new Error('Lab environment requires an eligible non-author reviewer');
 if(env.deployment_branch_policy?.protected_branches!==true ||
    env.deployment_branch_policy?.custom_branch_policies!==false)
  throw new Error('Lab environment must restrict dispatch to protected branches');
 return {independentEnvironmentReviewer:true,preventSelfReview:true,protectedBranchesOnly:true};
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
 const [pr,reviews,main,mainRules,environment]=await Promise.all([
   getGitHubJson('/pulls/'+EXPECTED_PR,token),
   getGitHubJson('/pulls/'+EXPECTED_PR+'/reviews?per_page=100',token),
   getGitHubJson('/branches/main',token),
   getGitHubJson('/rules/branches/main?per_page=100',token),
   getGitHubJson('/environments/'+EXPECTED_ENVIRONMENT,token)
 ]);
 const approved=verifyIndependentReleaseGate({pr,reviews,main,mainRules,context});
 const protectedEnvironment=verifyProtectedEnvironment(environment);
 // GitHub's immutable commit API returns the tree SHA for each exact commit.
 const getSourceTree=async sha=>{
   const commit=await getGitHubJson('/git/commits/'+sha,token);
   if(commit?.sha!==sha||!/^[a-f0-9]{40}$/.test(commit?.tree?.sha??''))
     throw new Error('Source commit is not independently verifiable');
   return getGitHubJson('/git/trees/'+commit.tree.sha+'?recursive=1',token);
 };
 const [approvedTree,currentTree]=await Promise.all([
   getSourceTree(pr.head.sha),getSourceTree(context.sha)
 ]);
 return {...approved,...protectedEnvironment,...verifyPinnedReviewedSource(approvedTree,currentTree)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assertGitHubReleaseGate().then(()=>{
   process.stdout.write('INDEPENDENT_GITHUB_REVIEW_AND_MAIN_PROTECTION_PASS: No secrets inspected; nonprod credential step still separate.\n');
 }).catch(()=>{
   process.stderr.write('NONPROD_AUTH_WRITE_HOLD: Require protected main and independent APPROVED review at exact bootstrap SHA. No credentials accessed.\n');
   process.exitCode=1;
 });
}
