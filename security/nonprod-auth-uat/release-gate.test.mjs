import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executionPlan,validateSnapshot,validateReadOnlyAudit,verifyInertHostedContents,runGuardedHostUat,MANUAL_CONFIRMATION,PREFLIGHT_CONFIRMATION,BASE_COUNTS} from './run-once.mjs';
import {makeBaseFixture} from './seed-inert-base-fixture.mjs';
import {EXPECTED_EXTENDED_COUNTS,composeExtendedFixture} from './compose-and-seed-remaining-fixture.mjs';
import {slotEmail} from './provision-nine-auth-users.mjs';
import { verifyIndependentReleaseGate,verifyPinnedReviewedSource,PINNED_RELEASE_PATHS,verifyProtectedEnvironment,EXPECTED_ENVIRONMENT } from './independent-release-approval.mjs';

const project='dhlhlasnaapzckjyvffn';
const env=()=>{
 const e={
  AMF_UAT_OPERATION:'AUDIT_ONLY',
  AMF_UAT_CONFIRMATION:MANUAL_CONFIRMATION,
  AMF_UAT_MODE:'EXECUTE',
  AMF_UAT_ACK:'I_ACCEPT_ISOLATED_SYNTHETIC_AUTH_ADMIN_NONPROD_ONLY',
  AMF_UAT_PROJECT_ID:project,
  AMF_UAT_SUPABASE_URL:'https://'+project+'.supabase.co',
  AMF_UAT_SERVICE_ROLE_KEY:'sb_secret_'+ 'S'.repeat(24),
  AMF_UAT_PASSWORD_MASTER_SECRET:'amf_uat_master_'+ 'm'.repeat(70),
  AMF_UAT_MAPPING_FILE:'/tmp/synthetic-uat-in-memory-mapping.json'
 };
 // Passwords are deterministically derived from the protected test-only master.
 return e;
};

const fakeFullInertClient=()=>{
 const users=Array.from({length:9},(_,i)=>({
  slot:i+1,id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),
  email:slotEmail(i+1),role:'authenticated'
 }));
 const mapping={project_id:project,users};
 const now='2026-11-13T09:00:00.000Z';
 const base=makeBaseFixture(mapping,now);
 const ext=composeExtendedFixture(mapping,now);
 const tables=Object.fromEntries([
  ['profiles',base.profiles],
  ['user_roles',base.roles],
  ['candidates',base.candidates],
  ...ext.batches.map(batch=>[batch.table,batch.rows])
 ]);
 let writes=0;
 const client={
  auth:{admin:{listUsers:async()=>({data:{users:users.map(u=>({...u}))},error:null})}},
  from:table=>({
   select:async(_projection,options)=>options?.head?
    {count:tables[table].length,error:null}:
    {data:tables[table].map(row=>({...row})),error:null},
   insert:async()=>{writes++;throw new Error('No writes allowed')},
   delete:async()=>{writes++;throw new Error('No writes allowed')}
  })
 };
 return {client,tables,users,writes:()=>writes};
};

const expectedTables={...BASE_COUNTS,...EXPECTED_EXTENDED_COUNTS};
const snapshot=(stage)=>{
 const count={};
 for(const k of Object.keys(expectedTables))
   count[k]=stage==='EMPTY'?0:stage==='BASE'?(BASE_COUNTS[k]??0):expectedTables[k];
 return {authUsers:stage==='EMPTY'?0:9,tableCounts:count,
  totalRows:Object.values(count).reduce((a,b)=>a+b,0)};
};
const fakeClient=(counts=snapshot('EMPTY'))=>{
 let mutated=false;
 const client={
  auth:{admin:{listUsers:async()=>({data:{users:Array.from({length:counts.authUsers},(_,i)=>({id:'synthetic-'+i}))}}),
    createUser:async()=>{mutated=true;throw new Error('unreachable');},
    deleteUser:async()=>{mutated=true;throw new Error('unreachable');}}},
  from:(table)=>({select:async()=>({count:counts.tableCounts[table],error:null})})
 };
 return {client,mutated:()=>mutated};
};
test('release runner accepts only exact project, nine unique passwords and explicit manual confirmation',()=>{
 const forWrite=()=>({...env(),AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38',AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION});
 const ok=executionPlan(forWrite());
 assert.equal(ok.operation,'CREATE_NINE_AND_SEED_38');
 assert.equal(ok.credentials.users.length,9);
 assert.equal(new Set(ok.credentials.users.map(u=>u.password)).size,9);
 assert.deepEqual(ok.credentials.users.map(u=>u.password),executionPlan(forWrite()).credentials.users.map(u=>u.password));
 assert(ok.credentials.users.every(u=>u.password.length>=40&&!u.password.includes(env().AMF_UAT_PASSWORD_MASTER_SECRET)));
 for(const variation of [
  {AMF_UAT_PROJECT_ID:'wusntntcqgtpgokggdzv'},
  {AMF_UAT_SUPABASE_URL:'https://wusntntcqgtpgokggdzv.supabase.co'},
  {AMF_UAT_OPERATION:'PRODUCTION'},
  {AMF_UAT_CONFIRMATION:'yes'},
  {AMF_UAT_SERVICE_ROLE_KEY:'sb_publishable_not_admin'},
  {AMF_UAT_MAPPING_FILE:'./mapping.json'},
  {AMF_UAT_PASSWORD_MASTER_SECRET:'weak'}
 ])assert.throws(()=>executionPlan({...forWrite(),...variation}));
});
test('all nineteen source-shaped table cardinalities sum to 38 and support exact stages',()=>{
 assert.equal(Object.keys(expectedTables).length,19);
 assert.equal(Object.values(BASE_COUNTS).reduce((a,b)=>a+b,0),18);
 assert.equal(Object.values(EXPECTED_EXTENDED_COUNTS).reduce((a,b)=>a+b,0),20);
 for(const stage of ['EMPTY','BASE','FULL'])
  assert.equal(validateSnapshot(snapshot(stage),stage),true);
});
test('refuse non-empty, wrong role or wrong count at each required stage',()=>{
 const e=snapshot('EMPTY');e.authUsers=1;
 assert.throws(()=>validateSnapshot(e,'EMPTY'),/Auth/);
 const b=snapshot('BASE');b.tableCounts.profiles=9;
 assert.throws(()=>validateSnapshot(b,'BASE'),/cardinality/);
 const f=snapshot('FULL');f.tableCounts.billing=2;
 assert.throws(()=>validateSnapshot(f,'FULL'),/cardinality/);
 assert.throws(()=>validateSnapshot(snapshot('EMPTY'),'UNKNOWN'),/stage/);
});
test('audit-only mode reads counts and performs zero Auth or CRM writes',async()=>{
 const {client,mutated}=fakeClient();
 const out=await runGuardedHostUat({operation:'AUDIT_ONLY'},client);
 assert.deepEqual(out,{operation:'AUDIT_ONLY',authUsers:0,records:0,mutated:false,fixtureStage:'EMPTY'});
 assert.equal(mutated(),false);
});
test('write mode refuses a nonempty Auth tenant before account creation or fixture inserts',async()=>{
 const {client,mutated}=fakeClient({...snapshot('EMPTY'),authUsers:1});
 const guarded=executionPlan({...env(),AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38',AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION});
 await assert.rejects(runGuardedHostUat(guarded,client),/Auth/);
 assert.equal(mutated(),false);
});
test('no public endpoint, automatic schedule, prod secret or prod database source in manual runner',()=>{
 const code=readFileSync(new URL('./run-once.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(workflow.includes('workflow_dispatch:'));
 assert(workflow.includes("github.ref == 'refs/heads/main'"));
 assert(workflow.includes("github.actor == 'amfsynergyvision7'"));
 assert(workflow.includes('name: amf-nonprod-auth-review'));
 assert(workflow.includes('AMF_NONPROD_SERVICE_ROLE_KEY'));
 assert(workflow.includes('preflight_confirmation:'));
 assert(workflow.includes('AMF_UAT_PREFLIGHT_ATTESTATION:'));
 assert(workflow.includes('I_REVIEWED_FRESH_NONPROD_SQL_19_EMPTY_ZERO_AUTH_TRIGGERS_GRANTS_POLICIES'));
 assert(workflow.includes('AMF_UAT_PASSWORD_MASTER_SECRET'));
 assert(!workflow.includes('secrets.AMF_UAT_CASE_'));
 assert(!workflow.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'));
 assert(!workflow.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'));
 assert(!workflow.includes('schedule:'));
 assert(!workflow.includes('push:'));
 assert(!workflow.includes('wusntntcqgtpgokggdzv'));
 assert(!workflow.includes('supabase_admin'));
 assert(code.includes("validateSnapshot(before,'EMPTY')"));
 assert(code.includes("validateSnapshot(await readHostedSnapshot(client),'FULL')"));
 assert(!/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?auth\.users\b/i.test(code));
});
test('nine invalid-domain Auth users and sixteen inert fixtures preserve no real contact and no workflow activation',()=>{
 const auth=readFileSync(new URL('./provision-nine-auth-users.mjs',import.meta.url),'utf8');
 const fixture=readFileSync(new URL('./compose-and-seed-remaining-fixture.mjs',import.meta.url),'utf8');
 assert(auth.includes('@example.invalid'));
 assert(auth.includes('email_confirm: true'));
 assert(!auth.includes('inviteUserByEmail('));
 assert(fixture.includes("is_active:false"));
 assert(fixture.includes("auto_sync_enabled:false"));
 assert(fixture.includes("status:'synthetic_never_sent'"));
 assert(fixture.includes("invoice_number:null"));
 assert(fixture.includes("status:'never_run'"));
 assert(fixture.includes('populatedExtendedTables:16'));
});


test('BUILD88 cannot create nine GoTrue users without a separately reviewed, fresh SQL preflight attestation',()=>{
 const e={...env(),AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38'};
 assert.throws(()=>executionPlan(e),/preflight attestation/);
 assert.throws(()=>executionPlan({...e,AMF_UAT_PREFLIGHT_ATTESTATION:'I clicked YES'}),/preflight attestation/);
 const ok=executionPlan({...e,AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION});
 assert.equal(ok.operation,'CREATE_NINE_AND_SEED_38');
 assert.equal(ok.preflightAttested,true);
 assert.equal(ok.credentials.users.length,9);
});
test('BUILD88 direct-runner rejects arbitrary operations and missing nonprod credentials without API writes',async()=>{
 const f=fakeClient();
 await assert.rejects(runGuardedHostUat({operation:'WRONG'},f.client),/Unknown isolated hosted operation/);
 await assert.rejects(runGuardedHostUat({operation:'CREATE_NINE_AND_SEED_38'},f.client),/Fresh hosted preflight attestation missing/);
 await assert.rejects(runGuardedHostUat({operation:'CREATE_NINE_AND_SEED_38',preflightAttested:true},f.client),/Invalid exact nonproduction synthetic plan/);
 assert.equal(f.mutated(),false);
});
test('BUILD88 read-only SQL preflight inspects all 19 app tables plus Auth triggers, public grants and RLS',()=>{
 const sql=readFileSync(new URL('./build88-hosted-preflight.readonly.sql',import.meta.url),'utf8');
 for(const table of Object.keys(expectedTables)){
   assert(sql.includes('FROM public.'+table),'missing source table '+table);
 }
 assert.equal((sql.match(/AS row_count FROM public\./g)||[]).length,19);
 for(const item of ['FROM auth.users','enabled_auth_user_triggers','enabled_app_triggers',
  'public_rls_policies','public_tables_with_caller_grants','callable_public_functions',
  'exposed_public_views','unprotected_public_tables','public_table_count',
  'service_role_tables_missing_fixture_privileges','ready_for_reviewed_synthetic_provisioning']){
   assert(sql.includes(item),'missing safety audit '+item);
 }
 assert(sql.includes("public_table_count=19"));
 assert(sql.includes("service_role_tables_missing_fixture_privileges=0"));
 assert(!/\b(?:insert|update|delete|create|drop|alter|truncate)\s+(?:into\s+|from\s+)?(?:public|auth)\./i.test(sql));
});
test('BUILD88 GitHub manual workflow requires fresh preflight only for write operation, not audit',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 const guard=workflow.slice(workflow.indexOf('  manual_provisioning:'));
 assert(guard.includes("inputs.operation == 'AUDIT_ONLY' ||"));
 assert(guard.includes('inputs.preflight_confirmation == '));
 assert(guard.includes('AMF_UAT_PREFLIGHT_ATTESTATION:'));
 assert(guard.includes('github.ref == '));
 assert(!guard.includes('pull_request:'));
});


const githubGateFixture=()=>{
 const reviewSha='b'.repeat(40);
 return {
  context:{repository:'amfsynergyvision7/synergy-recruit-hub',eventName:'workflow_dispatch',
   ref:'refs/heads/main',actor:'amfsynergyvision7',sha:'a'.repeat(40)},
  main:{name:'main',protected:true,commit:{sha:'a'.repeat(40)}},
  pr:{number:15,merged:true,state:'closed',
   base:{ref:'main'},head:{ref:'release/nonprod-auth-uat-gate-20261113',sha:reviewSha},
   user:{login:'amfsynergyvision7'}},
  reviews:[{user:{login:'independent-approver'},state:'APPROVED',
   author_association:'COLLABORATOR',commit_id:reviewSha,
   submitted_at:'2026-11-13T08:00:00Z'}]
 };
};
test('only a protected main branch with current independent approval unlocks real UAT write',()=>{
 assert.deepEqual(verifyIndependentReleaseGate(githubGateFixture()),
  {independentApproved:true,protectedMain:true,approvedPr:15});
});
test('unprotected or advanced main, wrong actor, nonmanual trigger, wrong repo or branch fail closed',()=>{
 const x=githubGateFixture();
 const overrides=[
  {...x,main:{...x.main,protected:false}},
  {...x,main:{...x.main,commit:{sha:'c'.repeat(40)}}},
  {...x,context:{...x.context,actor:'untrusted'}},
  {...x,context:{...x.context,eventName:'pull_request'}},
  {...x,context:{...x.context,repository:'other/other'}},
  {...x,context:{...x.context,ref:'refs/heads/test'}},
  {...x,context:{...x.context,sha:'invalid'}}
 ];
 for(const item of overrides)
  assert.throws(()=>verifyIndependentReleaseGate(item),/trusted manual|protected/i);
});
test('unmerged/wrong PR, unreviewed head commit, empty reviewer list are rejected',()=>{
 const x=githubGateFixture();
 for(const changes of [
  {...x,pr:{...x.pr,merged:false}},
  {...x,pr:{...x.pr,head:{...x.pr.head,sha:'c'.repeat(40)}}},
  {...x,pr:{...x.pr,number:12}},
  {...x,pr:{...x.pr,base:{ref:'preview'}}},
  {...x,reviews:[]},
  {...x,reviews:Array.from({length:100},()=>x.reviews[0])}
 ])assert.throws(()=>verifyIndependentReleaseGate(changes),/review|PR|inventory|merged/);
});
test('self-review, bot approval, nonmember review and stale SHA do not count as independent',()=>{
 const x=githubGateFixture();
 const badReviews=[
  {...x.reviews[0],user:{login:'amfsynergyvision7'}},
  {...x.reviews[0],user:{login:'some-bot[bot]'}},
  {...x.reviews[0],author_association:'NONE'},
  {...x.reviews[0],commit_id:'c'.repeat(40)}
 ];
 for(const review of badReviews)
  assert.throws(()=>verifyIndependentReleaseGate({...x,reviews:[review]}),/Fresh independent/);
});
test('newer CHANGES_REQUESTED or dismissed review invalidates earlier approval',()=>{
 const x=githubGateFixture();
 for(const state of ['CHANGES_REQUESTED','DISMISSED']){
  const later={...x.reviews[0],state,submitted_at:'2026-11-13T09:00:00Z'};
  assert.throws(()=>verifyIndependentReleaseGate({...x,reviews:[x.reviews[0],later]}),
    state==='CHANGES_REQUESTED'?/Outstanding independent changes-requested/:/Fresh independent/);
 }
});
test('source gates require independent PR signature and protected branch BEFORE fixture secret access',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 assert(workflow.includes('pull-requests: read'));
 assert(workflow.includes('Verify protected main, independent PR approval and exact source BEFORE lab-key access'));
 assert(workflow.includes('run: node security/nonprod-auth-uat/independent-release-approval.mjs'));
 assert(workflow.indexOf('run: node security/nonprod-auth-uat/independent-release-approval.mjs') <
        workflow.indexOf('AMF_UAT_SERVICE_ROLE_KEY:'));
 assert(gate.includes("main?.protected"));
 assert(gate.includes("r.commit_id===pr.head.sha"));
 assert(gate.includes("r.author_association"));
 assert(gate.includes("redirect:'error'"));
 assert(!gate.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert(!gate.includes('AMF_NONPROD_SERVICE_ROLE_KEY'));
 assert(!gate.includes('await fetch(') || gate.includes('method:'));
});


test('BUILD88 one independent change request overrides any other valid approval until resolved',()=>{
 const x=githubGateFixture();
 const veto={...x.reviews[0],user:{login:'second-independent-reviewer'},
   author_association:'COLLABORATOR',
   state:'CHANGES_REQUESTED',
   submitted_at:'2026-11-13T09:30:00Z'};
 assert.throws(()=>verifyIndependentReleaseGate({...x,reviews:[x.reviews[0],veto]}),/Outstanding independent changes-requested/);
});


test('Build89 preseed source checker pins exactly 30 original plus two explicit hardened function hashes',()=>{
 const sql=readFileSync(new URL('./build89-hosted-preseed-two-hardenings.readonly.sql',import.meta.url),'utf8');
 assert.match(sql,/Build89 nonproduction preseed: READ ONLY/);
 assert.match(sql,/source exact|source-pinned|source hashes/i);
 assert.match(sql,/0b3f5aefd663dae047d866fddc805c96/);
 assert.match(sql,/1966ef60466b78a94bd0f700a8ae9468/);
 assert.match(sql,/f0e8035858775f92d6d3077f11a02fe8/);
 assert.match(sql,/553468e85bd324fcd4f3153321dc1d70/);
 assert.match(sql,/safe_hardened_function_variants=2/);
 assert.match(sql,/approved_source_or_hardened_app_triggers=32/);
 assert.match(sql,/auth_user_hooks=0 AND auth_user_count=0/);
 assert.match(sql,/not_disabled_app_triggers=0/);
 assert.match(sql,/search_path=""/);
 assert.match(sql,/NOT has_function_privilege\('anon'/);
 assert.match(sql,/NOT has_function_privilege\('authenticated'/);
 assert.match(sql,/TECHNICAL_PRESEED_30_EXACT_PLUS_2_HARDENED_PASS_NOT_PROVISIONING_PERMISSION/);
 assert(!/\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\s+(?:TABLE|SCHEMA|ROLE|FUNCTION|VIEW)\b/i.test(sql.split('WITH expected_tables')[1]));
});

test('Build89 historical exact-source verifier remains unchanged and cannot silently accept function hardenings',()=>{
 const current=readFileSync(new URL('./build89-hosted-preseed-two-hardenings.readonly.sql',import.meta.url),'utf8');
 const historicHash="0e559d0265e39ff0e099ca1bbe0f784d7c685f7d";
 assert(current.includes(historicHash));
 // Historical hashes appear in the comment only; only exact reviewed
 // hardened hashes are accepted in the executable expected-triggers CTE.
 const query=current.split('WITH expected_tables')[1];
 assert(!query.includes("'e400aad0d20359265b58d9718d4f48a4'"));
 assert(!query.includes("'86c1f9eb50c225a673ae61e82d4e7397'"));
 assert(query.includes("'0b3f5aefd663dae047d866fddc805c96'"));
 assert(query.includes("'1966ef60466b78a94bd0f700a8ae9468'"));
 assert(query.includes("ELSE 'HOLD_NONPROD_PRESEED_SCHEMA_TRIGGER_AUTH_OR_GRANTS'"));
});

test('Build89 hardened checker is a technical preseed only; it never creates a real UAT account',()=>{
 const sql=readFileSync(new URL('./build89-hosted-preseed-two-hardenings.readonly.sql',import.meta.url),'utf8');
 const runner=readFileSync(new URL('./run-once.mjs',import.meta.url),'utf8');
 assert(sql.includes("NOT_PROVISIONING_PERMISSION"));
 assert(runner.includes("validateSnapshot(before,'EMPTY')"));
 assert(runner.includes("preflightAttested"));
 assert(!sql.includes('auth.admin.createUser'));
});

test('Build90 checks exact reviewed source tree including package lock and workflow',()=>{
 assert(PINNED_RELEASE_PATHS.includes('package-lock.json'));
 assert(PINNED_RELEASE_PATHS.includes('security/nonprod-auth-uat/run-once.mjs'));
 assert(PINNED_RELEASE_PATHS.includes('.github/workflows/nonprod-synthetic-auth-uat.yml'));
 assert.equal(new Set(PINNED_RELEASE_PATHS).size,PINNED_RELEASE_PATHS.length);
 const mkTree=()=>({truncated:false,tree:PINNED_RELEASE_PATHS.map(path=>({
  path,type:'blob',sha:'a'.repeat(40)
 }))});
 const approved=mkTree(),running=mkTree();
 assert.deepEqual(verifyPinnedReviewedSource(approved,running),
  {reviewedSourceFiles:PINNED_RELEASE_PATHS.length});
 for(const path of PINNED_RELEASE_PATHS){
   const changed=mkTree();
   changed.tree.find(f=>f.path===path).sha='b'.repeat(40);
   assert.throws(()=>verifyPinnedReviewedSource(approved,changed),/Unreviewed change/);
 }
});
test('Build90 rejects incomplete, truncated and malformed Git tree inventories',()=>{
 const mkTree=()=>({truncated:false,tree:PINNED_RELEASE_PATHS.map(path=>({
  path,type:'blob',sha:'a'.repeat(40)
 }))});
 const approved=mkTree();
 const variants=[
  {...mkTree(),truncated:true},
  {...mkTree(),tree:null},
  {...mkTree(),tree:mkTree().tree.slice(1)},
  {...mkTree(),tree:[...mkTree().tree,{...mkTree().tree[0]}]},
  {...mkTree(),tree:mkTree().tree.map((x,i)=>i===0?{...x,type:'tree'}:x)},
  {...mkTree(),tree:mkTree().tree.map((x,i)=>i===0?{...x,sha:'bad'}:x)}
 ];
 for(const variant of variants)
  assert.throws(()=>verifyPinnedReviewedSource(approved,variant),
   /Complete approved|Unreviewed change|Malformed reviewed/);
});
test('Build90 Git-tree proof follows independent review and precedes privileged secrets',()=>{
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 assert(gate.includes('verifyIndependentReleaseGate({pr,reviews,main,context})'));
 assert(gate.includes("getGitHubJson('/git/commits/'+sha,token)"));
 assert(gate.includes("getGitHubJson('/git/trees/'+commit.tree.sha+'?recursive=1',token)"));
 assert(gate.includes('verifyPinnedReviewedSource(approvedTree,currentTree)'));
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(workflow.indexOf('independent-release-approval.mjs') < workflow.indexOf('AMF_UAT_SERVICE_ROLE_KEY:'));
});

test('Build90 protects against concurrent nonproduction writes and mutable Actions tags',()=>{
 const yaml=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 const manual=yaml.slice(yaml.indexOf('  manual_provisioning:'));
 assert(manual.includes('concurrency:'));
 assert(manual.includes('group: amf-nonprod-auth-uat-'));
 assert(manual.includes('cancel-in-progress: false'));
 assert.equal((yaml.match(/actions\/checkout@[a-f0-9]{40}/g)||[]).length,2);
 assert.equal((yaml.match(/actions\/setup-node@[a-f0-9]{40}/g)||[]).length,2);
 assert(!yaml.includes('actions/checkout@v4'));
 assert(!yaml.includes('actions/setup-node@v4'));
});

test('Build91 neither AUDIT_ONLY nor CREATE can access lab credentials without independently approved source',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 const section=workflow.slice(workflow.indexOf('  manual_provisioning:'));
 const steps=section.slice(section.indexOf('    steps:'));
 const gateIndex=steps.indexOf('run: node security/nonprod-auth-uat/independent-release-approval.mjs');
 const credentialIndex=steps.indexOf('AMF_UAT_SERVICE_ROLE_KEY:');
 assert(gateIndex>=0 && credentialIndex>gateIndex);
 const gateStep=steps.slice(steps.lastIndexOf('      - name:',gateIndex),gateIndex);
 assert(!gateStep.includes('if:')); // no operation-specific bypass
 assert(section.includes("inputs.operation == 'AUDIT_ONLY'"));
 assert(section.includes("inputs.preflight_confirmation == 'I_REVIEWED_FRESH_NONPROD_SQL_19_EMPTY_ZERO_AUTH_TRIGGERS_GRANTS_POLICIES'"));
 assert(!steps.includes("if: inputs.operation == 'CREATE_NINE_AND_SEED_38'"));
});

test('Build91 requires a configured GitHub environment with a distinct reviewer and protected branch rule',()=>{
 const environment=()=>({
  name:EXPECTED_ENVIRONMENT,
  protection_rules:[{type:'required_reviewers',prevent_self_review:true,
    reviewers:[{type:'User',reviewer:{login:'different-human-reviewer'}}]}],
  deployment_branch_policy:{protected_branches:true,custom_branch_policies:false}
 });
 assert.deepEqual(verifyProtectedEnvironment(environment()),
  {independentEnvironmentReviewer:true,preventSelfReview:true,protectedBranchesOnly:true});
 const invalid=[
  {...environment(),name:'production'},
  {...environment(),protection_rules:[]},
  {...environment(),protection_rules:[{...environment().protection_rules[0],prevent_self_review:false}]},
  {...environment(),protection_rules:[{...environment().protection_rules[0],reviewers:[]}]},
  {...environment(),protection_rules:[{...environment().protection_rules[0],
    reviewers:[{type:'User',reviewer:{login:'amfsynergyvision7'}}]}]},
  {...environment(),protection_rules:[{...environment().protection_rules[0],
    reviewers:[{type:'User',reviewer:{login:'bot[bot]'}}]}]},
  {...environment(),deployment_branch_policy:{protected_branches:false,custom_branch_policies:true}},
  {...environment(),deployment_branch_policy:null},
  {...environment(),protection_rules:null}
 ];
 for(const x of invalid)
  assert.throws(()=>verifyProtectedEnvironment(x),/environment|reviewer|protected/i);
});
test('Build91 runtime fetches protected environment metadata and has limited read-only Actions permission',()=>{
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(gate.includes("getGitHubJson('/environments/'+EXPECTED_ENVIRONMENT,token)"));
 assert(gate.includes('verifyProtectedEnvironment(environment)'));
 assert(workflow.includes('  actions: read'));
 assert(!workflow.includes('  actions: write'));
 const code=workflow.slice(workflow.indexOf('  manual_provisioning:'));
 assert(code.indexOf('independent-release-approval.mjs')<code.indexOf('AMF_UAT_SERVICE_ROLE_KEY:'));
});

test('Build92 hosted schema drift source is pinned, read-only and nonproduction scoped',()=>{
 const path=new URL('./build92-hosted-schema-contract.readonly.sql',import.meta.url);
 const sql=readFileSync(path,'utf8');
 const observation=JSON.parse(readFileSync(new URL('./build92-hosted-schema-observation.json',import.meta.url),'utf8'));
 assert(PINNED_RELEASE_PATHS.includes('security/nonprod-auth-uat/build92-hosted-schema-contract.readonly.sql'));
 assert(PINNED_RELEASE_PATHS.includes('security/nonprod-auth-uat/build92-hosted-schema-observation.json'));
 assert.equal(observation.project_id,'dhlhlasnaapzckjyvffn');
 assert.equal(observation.scope,'LIVE_NONPRODUCTION_READ_ONLY');
 assert.equal(observation.mutations,0);
 assert.equal(observation.columns_seen,239);
 assert.equal(observation.required_no_default_columns,101);
 assert.equal(observation.schema_fingerprint,'e51f1648c517e88831a3c07740476bf3');
 assert(sql.includes(observation.schema_fingerprint));
 assert(sql.includes('TECHNICAL_FIXTURE_SCHEMA_BASELINE_PASS_NOT_PROVISIONING_PERMISSION'));
 assert(sql.includes('HOLD_FIXTURE_SCHEMA_DRIFT'));
 assert(sql.includes('columns_seen=239'));
 assert(sql.includes('required_no_default_columns=101'));
 assert(sql.includes("table_schema='public'"));
 for(const name of Object.keys(expectedTables))
  assert(sql.includes("'"+name+"'"),'source schema table omitted: '+name);
 assert.equal((sql.match(/WITH cols AS/g)||[]).length,1);
 assert(!/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?(?:public\.|auth\.|information_schema\.)/i.test(sql));
});

test('Build93 audit-only uses isolated Admin key but never requires/derives a password master',()=>{
 const cfg=env();
 delete cfg.AMF_UAT_PASSWORD_MASTER_SECRET;
 const result=executionPlan(cfg);
 assert.equal(result.operation,'AUDIT_ONLY');
 assert.equal(result.credentials.url,'https://'+project+'.supabase.co');
 assert.equal(typeof result.credentials.key,'string');
 assert.equal(result.credentials.users,undefined);
 assert.equal(result.preflightAttested,false);
 assert.throws(()=>executionPlan({...cfg,AMF_UAT_OPERATION:'CREATE_NINE_AND_SEED_38',
  AMF_UAT_PREFLIGHT_ATTESTATION:PREFLIGHT_CONFIRMATION}),/password master/);
 assert.throws(()=>executionPlan({...cfg,AMF_UAT_PROJECT_ID:'wusntntcqgtpgokggdzv'}),/non-allowlisted/);
 assert.throws(()=>executionPlan({...cfg,AMF_UAT_SERVICE_ROLE_KEY:'sb_publishable_unsafe'}),/service.role|Server-only/i);
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(workflow.includes("AMF_UAT_PASSWORD_MASTER_SECRET: ${{ inputs.operation == 'CREATE_NINE_AND_SEED_38' && secrets.AMF_UAT_PASSWORD_MASTER_SECRET || '' }}"));
});
test('Build93 guarded hosted audit accepts only complete empty or exact 9-user/38-row synthetic fixture',async()=>{
 const empty=snapshot('EMPTY');
 assert.equal(validateReadOnlyAudit(empty),'EMPTY');
 for(const stage of ['BASE','FULL']){
  const specimen=snapshot(stage);
  if(stage==='BASE')
   assert.throws(()=>validateReadOnlyAudit(specimen),/partial or unexpected/);
  else {
   specimen.syntheticAuthSlotsValid=true;
   assert.equal(validateReadOnlyAudit(specimen),'FULL');
   specimen.syntheticAuthSlotsValid=false;
   assert.throws(()=>validateReadOnlyAudit(specimen),/unexpected Auth identities/);
   specimen.syntheticAuthSlotsValid=true;
   specimen.tableCounts.billing=2;
   assert.throws(()=>validateReadOnlyAudit(specimen),/cardinality/);
  }
 }
 const mock=fakeFullInertClient();
 const plan=executionPlan({...env(),AMF_UAT_PASSWORD_MASTER_SECRET:undefined});
 const valid=await runGuardedHostUat(plan,mock.client);
 assert.equal(valid.fixtureStage,'FULL');
 assert.deepEqual({users:valid.authUsers,rows:valid.records,mutated:valid.mutated},
  {users:9,rows:38,mutated:false});
 assert.equal(mock.writes(),0);
 // Wrong or duplicated identity is a mandatory HOLD even if 9/38 counts match.
 const old=mock.client.auth.admin.listUsers;
 mock.client.auth.admin.listUsers=async()=>{
  const response=await old();
  response.data.users[8].email='unknown@example.invalid';
  return response;
 };
 await assert.rejects(runGuardedHostUat(plan,mock.client),/unexpected Auth identities/);
});

test('Build95 a complete 9/38 synthetic fixture audit inspects inert billing, sync, email, workflow and owner data',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 const expected=executionPlan({...env(),AMF_UAT_PASSWORD_MASTER_SECRET:undefined});
 const success=await runGuardedHostUat(expected,client);
 assert.equal(success.fixtureStage,'FULL');
 assert.equal(success.mutated,false);
 assert.equal(writes(),0);
 // Every introduced dangerous state must block even if all counts stay 9/38.
 const corruptions=[
  ['workflow_rules','is_active',true],
  ['workflow_rules','field_value','active'],
  ['email_log','status','sent'],
  ['email_log','provider_id','provider-token'],
  ['email_log','to_email','real@example.com'],
  ['billing','invoice_number','INV-REAL'],
  ['billing','invoice_date','2026-11-13'],
  ['billing','invoice_amount',10],
  ['billing','payment_status','paid'],
  ['google_integrations','auto_sync_enabled',true],
  ['google_integrations','spreadsheet_id','live'],
  ['integrations','auto_sync',true],
  ['integrations','sheet_url','https://live.example'],
  ['sync_logs','status','success'],
  ['sync_logs','rows_created',1],
  ['offers','joining_date','2026-11-13'],
  ['offers','offer_status','accepted'],
  ['job_openings','status','published'],
  ['job_openings','is_confidential',false],
  ['clients','email','customer@example.com'],
  ['submissions','status','submitted'],
  ['interviews','status','scheduled'],
  ['notifications','type','email'],
  ['profiles','is_active',false],
  ['user_roles','role','viewer'],
  ['candidates','email','real@example.com'],
  ['candidates','assigned_recruiter','00000000-0000-0000-0000-000000000008'],
   ['candidate_activities','action_type','actual_contact'],
   ['candidate_activities','recruiter_id','00000000-0000-0000-0000-000000000008'],
   ['candidate_activities','notes','Candidate called on phone'],
   ['candidate_stage_history','new_stage','joined'],
   ['candidate_stage_history','changed_by','00000000-0000-0000-0000-000000000008'],
   ['candidate_stage_history','notes','Real candidate stage moved'],
   ['audit_logs','action','CANDIDATE_DELETE'],
   ['audit_logs','user_id','00000000-0000-0000-0000-000000000008'],
   ['audit_logs','details',{fixture_only:false,no_real_action:true}]
 ];
 for(const [table,field,bad] of corruptions){
  const prior=tables[table][0][field];
  tables[table][0][field]=bad;
  await assert.rejects(runGuardedHostUat(expected,client),/inert fixture HOLD/i,
   'Expected fail-closed audit for '+table+'.'+field);
  tables[table][0][field]=prior;
 }
 assert.equal(writes(),0);
});
test('Build95 content verification fails closed on missing projections and never calls mutating APIs',async()=>{
 const {client,writes}=fakeFullInertClient();
 client.from=table=>({select:async()=>({error:{message:'simulated read denial'},data:null})});
 await assert.rejects(verifyInertHostedContents(client),/readback unavailable/);
 assert.equal(writes(),0);
 const source=readFileSync(new URL('./run-once.mjs',import.meta.url),'utf8');
 const section=source.slice(source.indexOf('export async function verifyInertHostedContents('),
   source.indexOf('export async function runGuardedHostUat('));
 assert(!section.includes('.insert('));
 assert(!section.includes('.update('));
 assert(!section.includes('.delete('));
 assert(!section.includes('console.log'));
 assert(source.includes("if(fixtureStage==='FULL')await verifyInertHostedContents(client)"));
 assert(source.includes("await verifyInertHostedContents(client);"));
});


test('Build112 completed fixture audit covers all 19 tables, including action/history/audit records',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 const fields=[
  ['candidate_activities','candidate_id','00000000-0000-0000-0000-000000000009'],
  ['candidate_stage_history','previous_stage','offer_accepted'],
  ['audit_logs','table_name','billing'],
  ['audit_logs','details',{fixture_only:true,no_real_action:true,private_record:'real'}]
 ];
 for(const [table,field,invalid] of fields){
   const prior=tables[table][0][field];
   tables[table][0][field]=invalid;
   await assert.rejects(verifyInertHostedContents(client),
    /Hosted inert fixture HOLD: non-inert or mismatched/,
    'Expected missing-source-content hold: '+table+'.'+field);
   tables[table][0][field]=prior;
 }
 assert.equal(writes(),0,'Read-only fixture audit must never issue writes');
 const source=readFileSync(new URL('./run-once.mjs',import.meta.url),'utf8');
 const section=source.slice(source.indexOf('export async function verifyInertHostedContents('),
  source.indexOf('export async function runGuardedHostUat('));
 for(const table of ['candidate_activities','candidate_stage_history','audit_logs']){
  assert(section.includes("await read('"+table+"'"));
  assert(section.includes("reject('"+table+"')"));
 }
});
