import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executionPlan,validateSnapshot,validateReadOnlyAudit,readHostedSnapshot,verifyInertHostedContents,runGuardedHostUat,MANUAL_CONFIRMATION,PREFLIGHT_CONFIRMATION,BASE_COUNTS} from './run-once.mjs';
import {makeBaseFixture,seedInertBaseFixture} from './seed-inert-base-fixture.mjs';
import {EXPECTED_EXTENDED_COUNTS,composeExtendedFixture,seedExtendedFixture} from './compose-and-seed-remaining-fixture.mjs';
import {slotEmail,provisionNine,PROJECT_URL,isExactSyntheticAuthUser,syntheticAuthEvidenceFingerprint} from './provision-nine-auth-users.mjs';
import { verifyIndependentReleaseGate,verifyMinimumEnforcedMainRules,selectExactReviewedSafetyRun,verifyExactReviewedSafetyCi,verifyPinnedReviewedSource,PINNED_RELEASE_PATHS,verifyProtectedEnvironment,EXPECTED_ENVIRONMENT } from './independent-release-approval.mjs';
import {summarizeReleaseBlockers} from './release-blocker-report.mjs';

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

// Full GoTrue-shaped fake identities, wholly in memory; no real Auth access.
const mockSyntheticAuth=slot=>{
 const id='00000000-0000-0000-0000-'+String(slot).padStart(12,'0');
 const email=slotEmail(slot);
 return {
  slot,id,email,role:'authenticated',aud:'authenticated',
  email_confirmed_at:'2026-11-13T09:00:00Z',
  confirmed_at:'2026-11-13T09:00:00Z',phone:'',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{},is_anonymous:false,is_sso_user:false,factors:[],
  identities:[{user_id:id,provider:'email',
   identity_data:{email,sub:id,email_verified:true,phone_verified:false}}]
 };
};
const fakeFullInertClient=()=>{
 const users=Array.from({length:9},(_,i)=>mockSyntheticAuth(i+1));
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
  syntheticAuthSlotsValid:true,
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


const reviewedMainRules=()=>[
 {type:'pull_request',parameters:{
  required_approving_review_count:1,dismiss_stale_reviews_on_push:true,
  require_last_push_approval:true,required_review_thread_resolution:true}},
 {type:'required_status_checks',parameters:{
  required_status_checks:[{context:'Nonprod Auth runner contracts — no secrets'}]}},
 {type:'non_fast_forward'},
 {type:'deletion'}
];
const githubGateFixture=()=>{
 const reviewSha='b'.repeat(40);
 return {
  mainRules:reviewedMainRules(),
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
 assert(gate.includes('verifyIndependentReleaseGate({pr,reviews,main,mainRules,context})'));
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
   assert.throws(()=>validateReadOnlyAudit(specimen),/Auth identit/);
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
 await assert.rejects(runGuardedHostUat(plan,mock.client),/Auth identit/);
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
  ['email_log','subject','Real message'],
  ['email_log','body','Real candidate contact'],
  ['email_log','related_id','00000000-0000-0000-0000-000000000008'],
  ['workflow_rules','name','Actual active workflow'],
  ['workflow_rules','notify_target','email:someone@example.com'],
  ['workflow_rules','notify_message','Send candidate details'],
  ['workflow_rules','action_type','send_email'],
  ['job_openings','job_title','Actual vacancy'],
  ['job_openings','assigned_recruiter','00000000-0000-0000-0000-000000000008'],
  ['job_openings','created_by','00000000-0000-0000-0000-000000000008'],
  ['notifications','user_id','00000000-0000-0000-0000-000000000008'],
  ['notifications','title','Email real candidate'],
  ['notifications','message','Real candidate personal details'],
  ['clients','company_name','Actual Client Ltd'],
  ['clients','created_by','00000000-0000-0000-0000-000000000008'],
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


test('Build113 staged fixture rejects wrong synthetic Auth slots even with matching 9/38 counts',()=>{
 for(const stage of ['BASE','FULL']){
  const s=snapshot(stage);
  s.syntheticAuthSlotsValid=false;
  assert.throws(()=>validateSnapshot(s,stage),/Auth identity/);
  s.syntheticAuthSlotsValid=undefined;
  assert.throws(()=>validateSnapshot(s,stage),/Auth identity/);
 }
});

test('Build113 readHostedSnapshot rejects an Auth user replacement during table inventory',async()=>{
 const {client,mutated}=fakeClient();
 let reads=0;
 client.auth.admin.listUsers=async()=>{
  reads++;
  return {data:{users:reads===1?[]:[{id:'00000000-0000-0000-0000-000000000001',email:slotEmail(1)}]},error:null};
 };
 await assert.rejects(runGuardedHostUat({operation:'AUDIT_ONLY'},client),
  /Auth identity inventory changed/);
 assert.equal(reads,2);
 assert.equal(mutated(),false);
});

test('Build113 AUDIT_ONLY rechecks all 19 counts after full inert content inspection',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 let readCounts=0;
 const original=client.from;
 client.from=table=>{
  const handle=original(table);
  return {
   ...handle,
   select:async(projection,options)=>{
    if(options?.head && ++readCounts>19) {
     return {count:tables[table].length+(table==='billing'?1:0),error:null};
    }
    return handle.select(projection,options);
   }
  };
 };
 await assert.rejects(runGuardedHostUat({operation:'AUDIT_ONLY'},client),
  /partial or unexpected|cardinality/);
 assert.equal(writes(),0);
});


test('Build113 no-send, ownership and notification readbacks cover recipient/content as well as status',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 const failures=[
  ['notifications','user_id','00000000-0000-0000-0000-000000000009'],
  ['notifications','message','Real candidate details'],
  ['email_log','body','A real message'],
  ['workflow_rules','notify_target','actual@example.com'],
  ['clients','created_by','00000000-0000-0000-0000-000000000009'],
  ['job_openings','assigned_recruiter','00000000-0000-0000-0000-000000000009']
 ];
 for(const [table,field,bad] of failures){
  const old=tables[table][0][field];tables[table][0][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),/inert fixture HOLD/,
    'Required rejection: '+table+'.'+field);
  tables[table][0][field]=old;
 }
 assert.equal(writes(),0);
});


test('Build114 inert fixture rejects concealed candidate PII and generated resumes while IDs/counts stay valid',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 const hidden=[
  ['full_name','Actual Applicant Name'],
  ['mobile','+911234567890'],
  ['resume_url','https://external.example/real-resume.pdf'],
  ['notes','Sensitive candidate work history'],
  ['resume_summary','Real candidate summary'],
  ['ats_score',95],
  ['ats_issues',{issues:['sensitive']}],
  ['ats_checked_at','2026-11-14T00:00:00Z'],
  ['current_company','Real Employer'],
  ['position_applied','CEO'],
  ['location','Kolkata'],
  ['current_salary',100000],
  ['created_by','00000000-0000-0000-0000-000000000009']
 ];
 for(const [field,bad] of hidden){
  const old=tables.candidates[0][field];
  tables.candidates[0][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),/inert fixture HOLD/,
    'Concealed candidate value must hold audit: '+field);
  tables.candidates[0][field]=old;
 }
 assert.equal(writes(),0);
});

test('Build114 synthetic profile/CRM egress fields cannot hide real contact data',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 for(const [table,field,bad] of [
  ['profiles','full_name','Real Employee'],
  ['profiles','phone','+911234567890'],
  ['profiles','role_request','admin'],
  ['clients','contact_person','Real Person'],
  ['clients','phone','+911234567890'],
  ['clients','agreement_type','signed'],
  ['notifications','related_table','candidates'],
  ['notifications','related_id','00000000-0000-0000-0000-000000000001'],
  ['email_log','error','real provider trace'],
  ['workflow_rules','update_field_name','status'],
  ['workflow_rules','update_field_value','approved']
 ]){
  const old=tables[table][0][field];
  tables[table][0][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),/inert fixture HOLD/,
    'Concealed non-inert field must hold audit: '+table+'.'+field);
  tables[table][0][field]=old;
 }
 assert.equal(writes(),0,'Audit cannot mutate the database');
});

 
// Build140 regression: the service-role REST endpoint can return HTTP 200 but
// delete zero rows under an unexpected policy/permission state. That is NOT a
// verified compensating rollback. All mocks remain local/in-memory.
const rollbackFake=(mapping,{extended,returned='empty',residualTable=null,authDrift=false}={})=>{
 const users=mapping.users;
 let deletes=0;
 return {
  client:{
   auth:{admin:{listUsers:async()=>({data:{users:deletes>0&&authDrift?users.slice(0,8):users},error:null})}},
   from:table=>({
    select:async(_projection,opts)=>{
     if(opts?.head)return {count:(extended?(BASE_COUNTS[table]??0):0)+((deletes>0&&table===residualTable)?1:0),error:null};
     if(table==='candidates')return {data:users.slice(1,3).map(u=>({
      id:u.id,assigned_recruiter:u.id
     })),error:null};
     return {data:[],error:null};
    },
    insert:()=>({select:async()=>({error:{message:'in-memory simulated failed insert'},data:null})}),
    delete:()=>({in:(_column,ids)=>({select:async()=>{
     deletes++;
     return {error:null,data:returned==='exact'?
      ids.map(id=>({id})):returned==='duplicate'?
      ids.map(()=>({id:ids[0]})):returned==='wrong'?
      ids.map(()=>({id:'00000000-0000-0000-0000-999999999999'})):[]};
    }})})
   })
  },
  deleteCalls:()=>deletes
 };
};
test('Build140 base rollback flags 200 OK with zero, duplicate or unrelated deleted IDs',async()=>{
 const {users}=fakeFullInertClient();
 const mapping={project_id:project,users};
 for(const returned of ['empty','duplicate','wrong']){
  const f=rollbackFake(mapping,{extended:false,returned});
  await assert.rejects(seedInertBaseFixture(f.client,mapping),
   /1 cleanup calls unconfirmed/);
  assert.equal(f.deleteCalls(),1);
 }
 const exact=rollbackFake(mapping,{extended:false,returned:'exact'});
 await assert.rejects(seedInertBaseFixture(exact.client,mapping),
  /0 cleanup calls unconfirmed/);
});
test('Build140 extended rollback flags silent and incorrect deleted IDs',async()=>{
 const {users}=fakeFullInertClient();
 const mapping={project_id:project,users};
 for(const returned of ['empty','wrong']){
  const f=rollbackFake(mapping,{extended:true,returned});
  await assert.rejects(seedExtendedFixture(f.client,mapping),
   /1 table cleanup results unconfirmed/);
  assert.equal(f.deleteCalls(),1);
 }
 const exact=rollbackFake(mapping,{extended:true,returned:'exact'});
 await assert.rejects(seedExtendedFixture(exact.client,mapping),
  /0 table cleanup results unconfirmed/);
});

 
// Build140: a failed createUser may have committed an account even when no
// subject ID came back, and a successful deleteUser response is not proof
// that the account disappeared. Independently count the exact lab Auth state.
const syntheticNinePlan=()=>({
 url:PROJECT_URL,
 users:Array.from({length:9},(_,i)=>({
  slot:i+1,email:slotEmail(i+1),password:'in-memory-only-test-password-'+(i+1)
 }))
});
test('Build140 unknown createUser outcome rechecks Auth even with zero returned IDs',async()=>{
 const ghost=mockSyntheticAuth(1);
 let reads=0,deletes=0;
 const admin={
  listUsers:async()=>({data:{users:++reads===1?[]:[ghost]},error:null}),
  createUser:async()=>{throw new Error('simulated remote timeout after commit');},
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /1 cleanup operations unconfirmed/);
 assert.equal(reads,2);
 assert.equal(deletes,0);
});
test('Build140 successful deleteUser HTTP response does not mask surviving Auth subject',async()=>{
 const ghost=mockSyntheticAuth(1);
 let reads=0,created=0,deletes=0;
 const admin={
  listUsers:async()=>({data:{users:++reads===1?[]:[ghost]},error:null}),
  createUser:async()=>{
   if(++created===1)return {data:{user:ghost},error:null};
   throw new Error('simulated timeout after another Auth creation');
  },
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /1 cleanup operations unconfirmed/);
 assert.equal(reads,3);
 assert.equal(deletes,1);
});
test('Build140 Auth rollback reports zero unconfirmed only after independently empty readback',async()=>{
 let reads=0;
 const admin={
  listUsers:async()=>({data:{users:[]},error:null}),
  createUser:async()=>{throw new Error('simulated refusal without provider commit');},
  deleteUser:async()=>({error:null})
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),{
  ...admin,listUsers:async()=>{reads++;return admin.listUsers();}
 },async()=>{}),/0 cleanup operations unconfirmed/);
 assert.equal(reads,2);
});


// Build141: all 19 expected tables can have correct cardinalities while
// a candidate's synthetic submission is linked to the wrong fictional job,
// interview or invoice. These in-memory tests do not access Supabase.
test('Build141 accepts exact 2-job 2-submission 2-interview 1-offer 1-bill fixture relationships without writes',async()=>{
 const {client,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 assert.equal(writes(),0);
});
test('Build141 rejects wrong client/job/submission references while status and counts remain correct',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 const wrong='00000000-0000-0000-0000-000000000009';
 for(const [table,row,field,bad] of [
  ['job_openings',0,'client_id',wrong],
  ['job_openings',1,'client_uuid',wrong],
  ['submissions',0,'candidate_id',wrong],
  ['submissions',0,'candidate_uuid',wrong],
  ['submissions',0,'client_id',wrong],
  ['submissions',1,'client_uuid',wrong],
  ['submissions',0,'job_id',wrong],
  ['submissions',1,'job_uuid',wrong],
  ['submissions',1,'role_title','Unapproved real job'],
  ['submissions',0,'created_by',wrong]
 ]){
  const old=tables[table][row][field];tables[table][row][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),
   /Hosted inert fixture HOLD: non-inert or mismatched/,
   'Must hold mismatched '+table+'.'+field);
  tables[table][row][field]=old;
 }
 assert.equal(writes(),0);
});
test('Build141 rejects wrong interview/offer/billing relationships without changing inert flags',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 const wrong='00000000-0000-0000-0000-000000000009';
 for(const [table,row,field] of [
  ['interviews',0,'candidate_id'],
  ['interviews',1,'candidate_uuid'],
  ['interviews',1,'client_id'],
  ['interviews',0,'client_uuid'],
  ['interviews',0,'submission_uuid'],
  ['interviews',1,'created_by'],
  ['offers',0,'candidate_id'],
  ['offers',0,'candidate_uuid'],
  ['offers',0,'client_id'],
  ['offers',0,'client_uuid'],
  ['offers',0,'submission_uuid'],
  ['offers',0,'interview_uuid'],
  ['offers',0,'created_by'],
  ['billing',0,'candidate_id'],
  ['billing',0,'candidate_uuid'],
  ['billing',0,'client_id'],
  ['billing',0,'client_uuid'],
  ['billing',0,'offer_uuid'],
  ['billing',0,'created_by']
 ]){
  const old=tables[table][row][field];tables[table][row][field]=wrong;
  await assert.rejects(verifyInertHostedContents(client),
   /Hosted inert fixture HOLD: non-inert or mismatched/,
   'Must reject shifted '+table+'.'+field);
  tables[table][row][field]=old;
 }
 assert.equal(writes(),0);
});
test('Build141 relational audit uses narrow SELECT projections, never full row or writes',async()=>{
 const {client,writes}=fakeFullInertClient();
 const selections=[];
 const readOnly={
  auth:client.auth,
  from:table=>{
   const original=client.from(table);
   return {...original,select:(projection,options)=>{
    selections.push({table,projection});
    return original.select(projection,options);
   }};
  }
 };
 await verifyInertHostedContents(readOnly);
 for(const table of ['clients','job_openings','submissions','interviews','offers','billing']){
  assert(selections.some(q=>q.table===table && typeof q.projection==='string' &&
   q.projection.includes('id')),'Missing read-only relational inspection: '+table);
 }
 assert(selections.every(q=>q.projection!=='*'));
 assert.equal(writes(),0);
});


test('Build142 accepts only invented and empty private fields in every synthetic fixture',async()=>{
 const {client,writes}=fakeFullInertClient();
 assert.deepEqual(await verifyInertHostedContents(client),
  {verifiedNonproductionInertTables:19,contentMutations:0});
 assert.equal(writes(),0);
});
test('Build142 rejects concealed PII, scheduling content, sync errors and integration links',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 const invalids=[
  ['candidate_activities','candidate_name','Real Person'],
  ['candidate_activities','recruiter_name','Real Recruiter'],
  ['candidate_activities','module_created','real_crm'],
  ['candidate_activities','related_record_id','00000000-0000-0000-0000-000000000009'],
  ['audit_logs','user_email','private@example.com'],
  ['audit_logs','record_id','real-candidate-id'],
  ['clients','active_positions',2],
  ['job_openings','location','Private customer address'],
  ['job_openings','salary_min',1],
  ['job_openings','salary_max',90000],
  ['job_openings','priority','high'],
  ['job_openings','requirements','Real candidate profile'],
  ['job_openings','description','Identifying job details'],
  ['submissions','submission_date','2026-11-14'],
  ['submissions','remarks','Real customer details'],
  ['interviews','round','HR'],
  ['interviews','interview_date','2026-11-18'],
  ['interviews','interview_time','09:00'],
  ['interviews','mode','video'],
  ['interviews','feedback','Real interview notes'],
  ['interviews','scheduling_token','00000000-0000-0000-0000-000000000009'],
  ['interviews','proposed_slots',[{date:'2026-11-18'}]],
  ['offers','offer_date','2026-11-18'],
  ['google_integrations','sheet_name','Customer spreadsheet'],
  ['google_integrations','header_row',2],
  ['google_integrations','sync_frequency_minutes',5],
  ['google_integrations','last_synced_row',9],
  ['google_integrations','last_sync','2026-11-14T10:00:00Z'],
  ['google_integrations','last_error','Sensitive spreadsheet error'],
  ['google_integrations','column_mapping',{name:'private_person'}],
  ['google_integrations','mapping',{email:'real_person'}],
  ['integrations','module','real_google_sheet'],
  ['integrations','sheet_name','Connected sheet'],
  ['integrations','header_row',9],
  ['integrations','column_mapping',{id:'private'}],
  ['integrations','last_synced_row',20],
  ['integrations','last_sync_at','2026-11-14T10:00:00Z'],
  ['integrations','last_error','User identifier'],
  ['sync_logs','module','real_sync'],
  ['sync_logs','triggered_by','actual_user'],
  ['sync_logs','errors',['secret']],
  ['sync_logs','message','Real API response']
 ];
 for(const [table,field,bad] of invalids){
  const prior=tables[table][0][field];
  tables[table][0][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),
   /Hosted inert fixture HOLD: non-inert or mismatched/,
   'Must reject concealed '+table+'.'+field);
  if(prior===undefined)delete tables[table][0][field];
  else tables[table][0][field]=prior;
 }
 assert.equal(writes(),0);
});
test('Build142 reject malformed JSON empty-state variants and fabricated integration owner',async()=>{
 const {client,tables,writes}=fakeFullInertClient();
 for(const [table,field,bad] of [
  ['google_integrations','column_mapping',[]],
  ['google_integrations','mapping',[]],
  ['google_integrations','column_mapping',null],
  ['integrations','column_mapping',null],
  ['integrations','column_mapping',['user']],
  ['sync_logs','errors',{message:'hidden'}],
  ['google_integrations','user_id','00000000-0000-0000-0000-000000000009']
 ]){
  const old=tables[table][0][field];tables[table][0][field]=bad;
  await assert.rejects(verifyInertHostedContents(client),
   /Hosted inert fixture HOLD: non-inert or mismatched/);
  tables[table][0][field]=old;
 }
 assert.equal(writes(),0);
});


test('Build142 base failure cannot claim complete rollback with residual rows or changed Auth roster',async()=>{
 const {users}=fakeFullInertClient(),mapping={project_id:project,users};
 for(const opts of [{residualTable:'candidates'},{residualTable:'profiles'},{authDrift:true}]){
  const fake=rollbackFake(mapping,{extended:false,returned:'exact',...opts});
  await assert.rejects(seedInertBaseFixture(fake.client,mapping),
   /1 cleanup calls unconfirmed/);
  assert.equal(fake.deleteCalls(),1);
 }
});
test('Build142 extended failure rechecks all 16 targets and stable base/Auth, including untouched tables',async()=>{
 const {users}=fakeFullInertClient(),mapping={project_id:project,users};
 for(const opts of [
  {residualTable:'workflow_rules'},
  {residualTable:'clients'},
  {residualTable:'candidates'},
  {authDrift:true}
 ]){
  const fake=rollbackFake(mapping,{extended:true,returned:'exact',...opts});
  await assert.rejects(seedExtendedFixture(fake.client,mapping),
   /1 table cleanup results unconfirmed/);
  assert.equal(fake.deleteCalls(),1);
 }
});


// Build143: a renamed real Auth identity may have a correct slot email and
// RLS role but still contain a genuine phone, privileged app claim, unconfirmed
// email, or external IdP. None is valid for invented-only hosted acceptance.
test('Build143 confirmed synthetic Auth allows only nine email-only unprivileged fictional slots',()=>{
 for(let slot=1;slot<=9;slot++){
  assert.equal(isExactSyntheticAuthUser(mockSyntheticAuth(slot),slot),true);
  assert.equal(isExactSyntheticAuthUser(mockSyntheticAuth(slot),slot===9?1:slot+1),false);
 }
 const accepted=mockSyntheticAuth(1);
 accepted.last_sign_in_at='2026-11-14T10:00:00Z';
 accepted.updated_at='2026-11-14T10:00:00Z';
 assert.equal(isExactSyntheticAuthUser(accepted,1),true);
});
test('Build143 synthetic Auth rejects unconfirmed, contactable, privileged, external or modified identities',()=>{
 const variants=[
  ['unconfirmed',u=>{u.email_confirmed_at=null;}],
  ['invalid confirmation',u=>{u.email_confirmed_at='invalid-date';}],
  ['privileged role',u=>{u.role='service_role';}],
  ['anonymous audience',u=>{u.aud='anon';}],
  ['real phone',u=>{u.phone='+919876543210';}],
  ['confirmed phone',u=>{u.phone_confirmed_at='2026-11-14T10:00:00Z';}],
  ['invited subject',u=>{u.invited_at='2026-11-14T10:00:00Z';}],
  ['banned subject',u=>{u.banned_until='2027-11-14T10:00:00Z';}],
  ['deleted subject',u=>{u.deleted_at='2026-11-14T10:00:00Z';}],
  ['pending email migration',u=>{u.new_email='customer@example.com';}],
  ['pending phone migration',u=>{u.new_phone='+919876543210';}],
  ['anonymous',u=>{u.is_anonymous=true;}],
  ['sso user',u=>{u.is_sso_user=true;}],
  ['enrolled factor',u=>{u.factors=[{factor_type:'phone'}];}],
  ['privileged app claim',u=>{u.app_metadata.role='admin';}],
  ['external app provider',u=>{u.app_metadata.provider='google';}],
  ['external app provider list',u=>{u.app_metadata.providers.push('google');}],
  ['unexpected user metadata',u=>{u.user_metadata.full_name='Real Person';}],
  ['changed metadata email',u=>{u.user_metadata.email='actual@business.com';}],
  ['unverified user metadata',u=>{u.user_metadata.email_verified=false;}],
  ['phone-verified user metadata',u=>{u.user_metadata.phone_verified=true;}],
  ['external identity provider',u=>{u.identities[0].provider='google';}],
  ['identity owned by other subject',u=>{u.identities[0].user_id='00000000-0000-0000-0000-000000000009';}],
  ['identity points to real email',u=>{u.identities[0].identity_data.email='real@business.com';}],
  ['identity conceals full name',u=>{u.identities[0].identity_data.full_name='Real Person';}],
  ['identity has verified phone',u=>{u.identities[0].identity_data.phone_verified=true;}],
  ['identity hides real phone',u=>{u.identities[0].identity_data.phone='+919900000000';}],
  ['identity has no expected data',u=>{u.identities[0].identity_data=null;}],
  ['identity verified for another subject',u=>{u.identities[0].identity_data.sub='00000000-0000-0000-0000-000000000009';}],
  ['no known identity',u=>{u.identities=[];}],
  ['multiple identity providers',u=>{u.identities.push({...u.identities[0]});}],
  ['no application metadata',u=>{u.app_metadata=null;}],
  ['array user metadata',u=>{u.user_metadata=['someone'];}]
 ];
 for(const [label,mutate] of variants){
  const u=mockSyntheticAuth(1); mutate(u);
  assert.equal(isExactSyntheticAuthUser(u,1),false,label);
 }
});
test('Build143 hosted full audit refuses hidden Auth metadata even with exact 9 users and 38 rows',async()=>{
 const {client,users,writes}=fakeFullInertClient();
 const payloads=[
  ['phone','+918888888888'],
  ['email_confirmed_at',null],
  ['app_metadata',{provider:'email',providers:['email'],role:'admin'}],
  ['identities',[{user_id:users[0].id,provider:'google'}]],
  ['user_metadata',{private_candidate_email:'real@business.com'}]
 ];
 for(const [field,bad] of payloads){
  const old=users[0][field];users[0][field]=bad;
  await assert.rejects(runGuardedHostUat({operation:'AUDIT_ONLY'},client),
   /Auth identit|Auth identity inventory changed/,
   'Hosted audit must reject '+field);
  await assert.rejects(verifyInertHostedContents(client),
   /malformed synthetic Auth subject mapping/,
   'Private content audit must reject '+field);
  users[0][field]=old;
 }
 assert.equal(writes(),0);
});
test('Build143 nine genuinely confirmed fake GoTrue subjects pass provisioning with sanitized mapping',async()=>{
 const plan=syntheticNinePlan(),created=[];
 const admin={
  listUsers:async()=>({data:{users:created.map(u=>({...u}))},error:null}),
  createUser:async({email,email_confirm,password})=>{
   assert.equal(email_confirm,true);
   assert.equal(typeof password,'string');
   const slot=plan.users.find(u=>u.email===email)?.slot;
   assert(Number.isInteger(slot));
   const subject=mockSyntheticAuth(slot);
   created.push(subject);
   return {data:{user:subject},error:null};
  },
  deleteUser:async()=>{throw new Error('Must not delete successful test users');}
 };
 let mapping=null;
 const result=await provisionNine(plan,admin,async m=>{mapping=m;});
 assert.equal(result.created_count,9);
 assert.equal(result.auth_tenant_verified,true);
 assert.equal(mapping.project_id,project);
 assert.equal(mapping.users.length,9);
 assert(mapping.users.every(x=>Object.keys(x).sort().join(',')==='email,id,slot'));
});
test('Build143 failed postcreation identity check refuses mapping and cleans exact invented IDs',async()=>{
 const plan=syntheticNinePlan(),created=[];
 const admin={
  // Clone nested metadata too: the simulated API response can be altered
  // without changing what the provider actually stored.
  listUsers:async()=>({data:{users:created.map(u=>({
   ...u,app_metadata:{...u.app_metadata}
  }))},error:null}),
  createUser:async({email})=>{
   const slot=plan.users.find(u=>u.email===email)?.slot;
   const subject=mockSyntheticAuth(slot);
   created.push(subject);
   return {data:{user:subject},error:null};
  },
  deleteUser:async id=>{
   const i=created.findIndex(u=>u.id===id);
   if(i>=0)created.splice(i,1);
   return {error:null};
  }
 };
 let listed=0;
 const original=admin.listUsers;
 admin.listUsers=async()=>{
  const out=await original();
  if(++listed===2)out.data.users[0].app_metadata.role='admin';
  return out;
 };
 let saved=false;
 await assert.rejects(provisionNine(plan,admin,async()=>{saved=true;}),
  /Synthetic provisioning aborted; 0 cleanup operations unconfirmed/);
 assert.equal(saved,false);
 assert.equal(created.length,0);
 assert.equal(listed,4);
});


test('Build143 standalone fixture writers refuse privileged or unverified Auth before any database mutation',async()=>{
 const identityProblems=[
  ['no confirmation',u=>{u.email_confirmed_at=null;}],
  ['real contact number',u=>{u.phone='+919900000000';}],
  ['privileged metadata',u=>{u.app_metadata.role='admin';}],
  ['external provider',u=>{u.identities[0].provider='google';}],
  ['personal metadata',u=>{u.user_metadata.full_name='Customer Name';}]
 ];
 for(const [label,change] of identityProblems){
  const {users}=fakeFullInertClient();
  const mapping={project_id:project,users};
  change(users[0]);
  for(const extended of [false,true]){
   const fake=rollbackFake(mapping,{extended,returned:'exact'});
   const fn=extended?()=>seedExtendedFixture(fake.client,mapping):
     ()=>seedInertBaseFixture(fake.client,mapping);
   await assert.rejects(fn(),/exact nine nonproduction GoTrue users|exact nine synthetic Auth users/i,
    label+' must prevent standalone test-data writes');
   assert.equal(fake.deleteCalls(),0,'No cleanup is needed before any inserts');
  }
 }
});

 
// Build144: protect against providerless otherwise confirmed accounts, while
// accepting legitimate GoTrue readbacks that omit expanded provider details.
test('Build144 requires explicit primary email provider or a validated email-only identity',()=>{
 const noProvider=mockSyntheticAuth(1);
 delete noProvider.app_metadata.provider;
 delete noProvider.identities;
 assert.equal(isExactSyntheticAuthUser(noProvider,1),false);
 const noIds=mockSyntheticAuth(1);
 delete noIds.identities;
 assert.equal(isExactSyntheticAuthUser(noIds,1),true);
 const providerByIdentity=mockSyntheticAuth(1);
 delete providerByIdentity.app_metadata.provider;
 assert.equal(isExactSyntheticAuthUser(providerByIdentity,1),true);
 const neither=mockSyntheticAuth(1);
 delete neither.app_metadata.provider;
 neither.identities=[];
 assert.equal(isExactSyntheticAuthUser(neither,1),false);
 const misclaimed=mockSyntheticAuth(1);
 misclaimed.app_metadata.provider='phone';
 assert.equal(isExactSyntheticAuthUser(misclaimed,1),false);
});
test('Build144 security evidence fingerprint ignores normal login timestamps but tracks identity semantics',()=>{
 const user=mockSyntheticAuth(1);
 const before=syntheticAuthEvidenceFingerprint(user);
 user.last_sign_in_at='2026-11-14T11:00:00Z';
 user.updated_at='2026-11-14T11:00:00Z';
 assert.equal(syntheticAuthEvidenceFingerprint(user),before);
 user.user_metadata.email=slotEmail(1);
 assert.notEqual(syntheticAuthEvidenceFingerprint(user),before);
});
test('Build144 read-only hosted snapshot detects metadata drift despite unchanged IDs and still-valid providers',async()=>{
 const {client,writes}=fakeFullInertClient();
 const original=client.auth.admin.listUsers;
 const variations=[
  u=>{u.user_metadata={email:u.email};},
  u=>{u.app_metadata={providers:['email']};},
  u=>{u.email_confirmed_at='2026-11-14T09:01:00Z';},
  u=>{u.identities=undefined;},
  u=>{u.confirmed_at='2026-11-14T10:01:00Z';}
 ];
 for(const modify of variations){
  let reads=0;
  client.auth.admin.listUsers=async()=>{
   const a=await original();
   if(++reads===2)modify(a.data.users[0]);
   return a;
  };
  await assert.rejects(readHostedSnapshot(client),
   /Auth identity inventory changed/);
  assert.equal(reads,2);
 }
 client.auth.admin.listUsers=original;
 const valid=await readHostedSnapshot(client);
 assert.equal(valid.authUsers,9);
 assert.equal(valid.syntheticAuthSlotsValid,true);
 assert.equal(writes(),0);
});
test('Build144 ordinary last-sign-in change cannot masquerade as a data-integrity failure',async()=>{
 const {client,writes}=fakeFullInertClient();
 const original=client.auth.admin.listUsers;
 let reads=0;
 client.auth.admin.listUsers=async()=>{
  const a=await original();
  if(++reads===2)a.data.users[0].last_sign_in_at='2026-11-14T12:00:00Z';
  return a;
 };
 assert.equal((await readHostedSnapshot(client)).syntheticAuthSlotsValid,true);
 assert.equal(reads,2);
 assert.equal(writes(),0);
});


// Build145: do not silently accept a "primary email" claim with no evidence
// that there is only one linked sign-in provider.
test('Build145 rejects bare email provider with no complete providers or identities inventory',()=>{
 const primaryOnly=mockSyntheticAuth(1);
 delete primaryOnly.app_metadata.providers;
 delete primaryOnly.identities;
 assert.equal(isExactSyntheticAuthUser(primaryOnly,1),false);
 const emptyProviderList=mockSyntheticAuth(1);
 delete emptyProviderList.identities;
 emptyProviderList.app_metadata.providers=[];
 assert.equal(isExactSyntheticAuthUser(emptyProviderList,1),false);
 const linkedOther=mockSyntheticAuth(1);
 linkedOther.app_metadata.providers=['email','google'];
 delete linkedOther.identities;
 assert.equal(isExactSyntheticAuthUser(linkedOther,1),false);
 const syntheticNoProviders=mockSyntheticAuth(1);
 delete syntheticNoProviders.app_metadata.providers;
 assert.equal(isExactSyntheticAuthUser(syntheticNoProviders,1),true,
   'A verified single email identity is sufficient even if providers list is omitted');
 const validEmailOnly=mockSyntheticAuth(1);
 delete validEmailOnly.identities;
 assert.equal(isExactSyntheticAuthUser(validEmailOnly,1),true,
   'Complete single-email providers list can substitute for omitted expanded identities');
});
test('Build145 hosted audit fails closed for unproven single email-only account',async()=>{
 const {client,users,writes}=fakeFullInertClient();
 for(const mutate of [
  u=>{delete u.app_metadata.providers;delete u.identities;},
  u=>{u.app_metadata.providers=['email','github'];delete u.identities;},
  u=>{u.app_metadata.providers=[];delete u.identities;}
 ]){
  const slot=users[0],oldApp=slot.app_metadata,oldIds=slot.identities;
  slot.app_metadata={...oldApp};slot.identities=oldIds;
  mutate(slot);
  await assert.rejects(runGuardedHostUat({operation:'AUDIT_ONLY'},client),
    /Auth identit|Auth identity inventory changed/);
  slot.app_metadata=oldApp;slot.identities=oldIds;
 }
 assert.equal(writes(),0);
});
test('Build145 standalone base/extended writers reject a primary-only unproven identity before writes',async()=>{
 const {users}=fakeFullInertClient(),mapping={project_id:project,users};
 delete users[0].app_metadata.providers;delete users[0].identities;
 for(const extended of [false,true]){
  const fake=rollbackFake(mapping,{extended,returned:'exact'});
  await assert.rejects(extended?seedExtendedFixture(fake.client,mapping):
    seedInertBaseFixture(fake.client,mapping),
    /exact nine nonproduction GoTrue users|exact nine synthetic Auth users/i);
  assert.equal(fake.deleteCalls(),0);
 }
});


// Build146: failed/uncertain GoTrue outcomes must never authorize deletion of
// another user's account based only on a returned UUID.
test('Build146 ignores UUID from failed createUser response and preserves unrelated account',async()=>{
 const stranger={...mockSyntheticAuth(1),email:'actual-business@example.com'};
 let reads=0,deletes=0;
 const admin={
  listUsers:async()=>({data:{users:++reads===1?[]:[stranger]},error:null}),
  createUser:async()=>({error:{message:'simulated failure'},data:{user:stranger}}),
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /1 cleanup operations unconfirmed/);
 assert.equal(reads,2);assert.equal(deletes,0);
});
test('Build146 malformed successful createUser subject is not eligible for deletion',async()=>{
 const wrong={...mockSyntheticAuth(1),email:'unknown-contact@example.invalid'};
 let reads=0,deletes=0;
 const admin={
  listUsers:async()=>({data:{users:++reads===1?[]:[wrong]},error:null}),
  createUser:async()=>({error:null,data:{user:wrong}}),
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /1 cleanup operations unconfirmed/);
 assert.equal(reads,2);assert.equal(deletes,0);
});
test('Build146 unexpected concurrent account stops every automatic Auth deletion',async()=>{
 const user=mockSyntheticAuth(1);
 const outside={...mockSyntheticAuth(2),email:'real-contact@example.com'};
 let subjects=[],writes=0,reads=0,deletes=0;
 const admin={
  listUsers:async()=>{reads++;return {data:{users:subjects.map(u=>({...u}))},error:null};},
  createUser:async()=>{
   if(++writes===1){subjects.push(user);return {data:{user},error:null};}
   subjects.push(outside);throw new Error('simulated concurrent Auth creation');
  },
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /2 cleanup operations unconfirmed/);
 assert.equal(writes,2);assert.equal(reads,3);assert.equal(deletes,0);
 assert.equal(subjects.length,2);
});
test('Build146 clean partial provisioning compensates only confirmed created identity',async()=>{
 const user=mockSyntheticAuth(1);
 let subjects=[],writes=0,reads=0,deletes=0;
 const admin={
  listUsers:async()=>{reads++;return {data:{users:subjects.map(u=>({...u}))},error:null};},
  createUser:async()=>{
   if(++writes===1){subjects.push(user);return {data:{user},error:null};}
   throw new Error('simulated refusal with no commit');
  },
  deleteUser:async id=>{deletes++;subjects=subjects.filter(u=>u.id!==id);return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /0 cleanup operations unconfirmed/);
 assert.equal(reads,3);assert.equal(deletes,1);assert.equal(subjects.length,0);
});
test('Build146 unavailable Auth precleanup inventory blocks deletion and reports HOLD',async()=>{
 const user=mockSyntheticAuth(1);
 let subjects=[],writes=0,reads=0,deletes=0;
 const admin={
  listUsers:async()=>{
   if(++reads===2)return {data:null,error:{message:'simulated unavailable inventory'}};
   return {data:{users:subjects.map(u=>({...u}))},error:null};
  },
  createUser:async()=>{
   if(++writes===1){subjects.push(user);return {data:{user},error:null};}
   throw new Error('simulated timeout');
  },
  deleteUser:async()=>{deletes++;return {error:null};}
 };
 await assert.rejects(provisionNine(syntheticNinePlan(),admin,async()=>{}),
  /2 cleanup operations unconfirmed/);
 assert.equal(reads,3);assert.equal(deletes,0);assert.equal(subjects.length,1);
});

const releaseReportPR=()=>({number:15,state:'open',merged:false,user:{login:'amfsynergyvision7'},
 head:{sha:'a'.repeat(40),ref:'release/nonprod-auth-uat-gate-20261113'},base:{ref:'main'}});
const releaseReportApproval=sha=>({user:{login:'independent-human'},state:'APPROVED',
 author_association:'COLLABORATOR',commit_id:sha,submitted_at:'2026-11-14T16:00:00Z'});
const releaseReportEnvironment=()=>({
 name:'amf-nonprod-auth-review',
 protection_rules:[{type:'required_reviewers',prevent_self_review:true,
  reviewers:[{type:'User',reviewer:{login:'independent-human'}}]}],
 deployment_branch_policy:{protected_branches:true,custom_branch_policies:false}
});

// Build147: advisory GitHub report cannot be mistaken for an approval,
// and it does not require secrets or write to protected production systems.
test('Build147 live gate summary is HOLD when main is unprotected and PR lacks reviews',()=>{
 const b=summarizeReleaseBlockers({
  main:{name:'main',protected:false},
  pr:releaseReportPR(),
  reviews:[],
  environment:null
 });
 assert.equal(b.status,'HOLD');
 assert.deepEqual(b.rows.map(x=>x.verdict),
  ['BLOCKED','UNVERIFIED','VERIFIED','BLOCKED','UNVERIFIED']);
});
test('Build147 inaccessible metadata never becomes a passing release control',()=>{
 const b=summarizeReleaseBlockers();
 assert.equal(b.status,'UNVERIFIED');
 assert.equal(b.checked,0);
 assert.equal(b.unverified,5);
});
test('Build147 source SHA and independent approval cannot be replaced by stale or self review',()=>{
 const pr=releaseReportPR(),yes=releaseReportApproval(pr.head.sha);
 const env=releaseReportEnvironment();
 assert.equal(summarizeReleaseBlockers({main:{name:'main',protected:true},
  mainRules:reviewedMainRules(),pr,reviews:[yes],environment:env}).status,'OWNER_REVIEW_REQUIRED');
 for(const stale of [
  {...yes,commit_id:'b'.repeat(40)},
  {...yes,user:{login:'amfsynergyvision7'}},
  {...yes,user:{login:'automated[bot]'}},
  {...yes,author_association:'NONE'}
 ])assert.equal(summarizeReleaseBlockers({
  main:{name:'main',protected:true},pr,reviews:[stale],environment:env
 }).status,'HOLD');
 const veto={...yes,user:{login:'other-independent'},state:'CHANGES_REQUESTED',
  submitted_at:'2026-11-14T17:00:00Z'};
 assert.equal(summarizeReleaseBlockers({
  main:{name:'main',protected:true},pr,reviews:[yes,veto],environment:env
 }).status,'HOLD');
});
test('Build147 unprotected environment and malformed PR both remain HOLD',()=>{
 const pr=releaseReportPR();
 const env=releaseReportEnvironment();
 env.protection_rules[0].prevent_self_review=false;
 const r=summarizeReleaseBlockers({
  main:{name:'main',protected:true},
  pr:{...pr,head:{...pr.head,ref:'unreviewed-other-branch'}},
  reviews:[releaseReportApproval(pr.head.sha)],environment:env
 });
 assert.equal(r.status,'HOLD');
 assert.equal(r.rows[2].verdict,'BLOCKED');
 assert.equal(r.rows[4].verdict,'BLOCKED');
});


test('Build147 closed-but-unmerged or falsely merged PR is not verified source state',()=>{
 const pr=releaseReportPR();
 for(const wrong of [
  {...pr,state:'closed'},
  {...pr,merged:true},
  {...pr,number:12},
  {...pr,head:{...pr.head,sha:'not-a-valid-sha'}}
 ]){
  const result=summarizeReleaseBlockers({
   main:{name:'main',protected:true},pr:wrong,
   reviews:[releaseReportApproval(pr.head.sha)],
   environment:releaseReportEnvironment()
  });
  assert.equal(result.rows[2].verdict,'BLOCKED');
  assert.equal(result.status,'HOLD');
 }
});


test('Build148 protected=true without effective PR/status rules must fail closed',()=>{
 const x=githubGateFixture();
 for(const mainRules of [undefined,null,[],[{type:'non_fast_forward'}]]){
  assert.throws(()=>verifyIndependentReleaseGate({...x,mainRules}),
   /main rules|active main rules/i);
 }
});
test('Build148 actively enforced branch rules require independent reviews and no bypass by direct push',()=>{
 assert.deepEqual(verifyMinimumEnforcedMainRules(reviewedMainRules()),{
  reviewRule:true,statusChecks:true,forcePushBlocked:true,deletionBlocked:true
 });
 const alterations=[
  x=>{x[0].parameters.required_approving_review_count=0;},
  x=>{x[0].parameters.dismiss_stale_reviews_on_push=false;},
  x=>{x[0].parameters.require_last_push_approval=false;},
  x=>{x[0].parameters.required_review_thread_resolution=false;},
  x=>{x[1].parameters.required_status_checks=[];},
  x=>{x[1].parameters.required_status_checks=[{context:'production-release-hold'}];},
  x=>{x.splice(2,1);},
  x=>{x.pop();}
 ];
 for(const mutate of alterations){
  const x=structuredClone(reviewedMainRules());mutate(x);
  assert.throws(()=>verifyMinimumEnforcedMainRules(x),/active main rules/i);
 }
});
test('Build148 advisory labels missing mandatory effective rules UNVERIFIED not release ready',()=>{
 const pr=releaseReportPR(),approved=releaseReportApproval(pr.head.sha);
 const b=summarizeReleaseBlockers({main:{name:'main',protected:true},
  mainRules:null,pr,reviews:[approved],environment:releaseReportEnvironment()});
 assert.equal(b.rows[0].verdict,'VERIFIED');
 assert.equal(b.rows[1].verdict,'UNVERIFIED');
 assert.equal(b.status,'UNVERIFIED');
 const bad=summarizeReleaseBlockers({main:{name:'main',protected:true},
  mainRules:[],pr,reviews:[approved],environment:releaseReportEnvironment()});
 assert.equal(bad.rows[1].verdict,'BLOCKED');
 assert.equal(bad.status,'HOLD');
});
test('Build148 rules API is consulted before privileged environment secrets',()=>{
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 const reporter=readFileSync(new URL('./release-blocker-report.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(gate.includes("getGitHubJson('/rules/branches/main?per_page=100',token)"));
 assert(gate.includes('verifyMinimumEnforcedMainRules(mainRules)'));
 assert(reporter.includes("'/rules/branches/main?per_page=100'"));
 assert(workflow.indexOf('run: node security/nonprod-auth-uat/independent-release-approval.mjs')<
  workflow.indexOf('AMF_UAT_SERVICE_ROLE_KEY:'));
});


// Build149: prevent a decorative green status check from satisfying an
// otherwise strongly configured ruleset. The production deliberate HOLD
// is deliberately never eligible as the required passing safety signal.
test('Build149 requires the actual nonprod contract CI context, not any green check',()=>{
 const exact=reviewedMainRules();
 assert.deepEqual(verifyMinimumEnforcedMainRules(exact),{
  reviewRule:true,statusChecks:true,forcePushBlocked:true,deletionBlocked:true
 });
 for(const unrelated of [
  'trivial-pass', 'Vercel', 'lint', 'production-release-hold',
  'Nonprod Auth runner contracts — no secrets but actually another job'
 ]){
  const rules=structuredClone(exact);
  rules[1].parameters.required_status_checks=[{context:unrelated}];
  assert.throws(()=>verifyMinimumEnforcedMainRules(rules),
    /Active main rules lack reviews|active main rules/i,unrelated);
 }
 const fullyQualified=structuredClone(exact);
 fullyQualified[1].parameters.required_status_checks=[{
  context:'Nonprod Synthetic Auth UAT — Manual Only / Nonprod Auth runner contracts — no secrets'
 }];
 assert.equal(verifyMinimumEnforcedMainRules(fullyQualified).statusChecks,true);
});
test('Build149 advisory source file is pinned to independently reviewed tree',()=>{
 const path='security/nonprod-auth-uat/release-blocker-report.mjs';
 assert(PINNED_RELEASE_PATHS.includes(path),'Missing source-hash pin for new advisory');
 const tree=()=>({truncated:false,tree:PINNED_RELEASE_PATHS.map((p,i)=>
  ({path:p,sha:String(i+1).padStart(40,'a'),type:'blob'}))});
 const approved=tree(),running=tree();
 assert.equal(verifyPinnedReviewedSource(approved,running).reviewedSourceFiles,
  PINNED_RELEASE_PATHS.length);
 const v=running.tree.find(x=>x.path===path);
 v.sha='b'.repeat(40);
 assert.throws(()=>verifyPinnedReviewedSource(approved,running),
  /Unreviewed change or missing release source file/);
});
test('Build149 advisory report explicitly records manual ruleset-bypass limitation',()=>{
 const src=readFileSync(new URL('./release-blocker-report.mjs',import.meta.url),'utf8');
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 assert(src.includes('the repository administrator must inspect and separately attest'));
 assert(gate.includes('REQUIRED_NONPROD_CONTRACT_CHECKS'));
 assert(gate.includes('"security/nonprod-auth-uat/release-blocker-report.mjs"'));
});


// Build150: live-shaped GitHub API results in memory, not credentials or network.
const exactSafetyProof=()=>{
 const sha='b'.repeat(40),runId=43629984174;
 const pr={number:15,head:{sha,ref:'release/nonprod-auth-uat-gate-20261113'}};
 const run={
  id:runId,run_number:78,run_attempt:1,
  name:'Nonprod Synthetic Auth UAT — Manual Only',
  path:'.github/workflows/nonprod-synthetic-auth-uat.yml',
  event:'pull_request',head_sha:sha,
  head_branch:'release/nonprod-auth-uat-gate-20261113',
  status:'completed',conclusion:'success',
  pull_requests:[{number:15,head:{sha}}]
 };
 const runs={total_count:1,workflow_runs:[run]};
 const jobs={total_count:2,jobs:[
  {name:'Nonprod Auth runner contracts — no secrets',
   run_id:runId,run_attempt:1,head_sha:sha,
   status:'completed',conclusion:'success'},
  {name:'Protected isolated Auth Admin and inert fixture',
   run_id:runId,run_attempt:1,head_sha:sha,
   status:'completed',conclusion:'skipped'}
 ]};
 return {pr,runs,jobs};
};
test('Build150 exact reviewed PR head requires a real completed workflow and real successful no-secret contract job',()=>{
 const x=exactSafetyProof();
 assert.deepEqual(verifyExactReviewedSafetyCi(x),{
  exactHeadSafetyCi:true,
  reviewedSafetyRunId:43629984174,
  credentialBearingJobSkipped:true
 });
});
test('Build150 no stale, foreign, manual or incomplete safety run may authorize secret access',()=>{
 const x=exactSafetyProof();
 const modifications=[
  a=>{a.runs.total_count=100;},
  a=>{a.runs.total_count=2;},
  a=>{a.runs.workflow_runs[0].head_sha='c'.repeat(40);},
  a=>{a.runs.workflow_runs[0].path='.github/workflows/untrusted.yml';},
  a=>{a.runs.workflow_runs[0].event='workflow_dispatch';},
  a=>{a.runs.workflow_runs[0].head_branch='unreviewed-branch';},
  a=>{a.runs.workflow_runs[0].pull_requests=[];},
  a=>{a.runs.workflow_runs[0].status='in_progress';},
  a=>{a.runs.workflow_runs[0].conclusion='failure';},
  a=>{a.runs.workflow_runs[0].run_attempt=0;},
  a=>{a.runs.workflow_runs[0].name='Green Status';},
  a=>{a.runs.workflow_runs[0].run_number=-1;}
 ];
 for(const mutate of modifications){
  const a=structuredClone(x);mutate(a);
  assert.throws(()=>verifyExactReviewedSafetyCi(a),
   /run inventory|provenance|workflow did not complete/);
 }
});
test('Build150 most recent safety run failure overrides an older exact-head success',()=>{
 const x=exactSafetyProof();
 const bad={...x.runs.workflow_runs[0],id:43629985000,
  run_number:79,conclusion:'failure'};
 x.runs.workflow_runs.unshift(bad);x.runs.total_count=2;
 assert.throws(()=>selectExactReviewedSafetyRun(x),
  /Latest reviewed safety workflow did not complete successfully/);
 bad.conclusion='success';bad.status='completed';
 assert.equal(selectExactReviewedSafetyRun(x).id,bad.id);
 assert.throws(()=>verifyExactReviewedSafetyCi(x),
  /Reviewed safety contracts not proven successful/,
  'Jobs belonging to older run must not count for later one');
});
test('Build150 no skipped, failed, detached or ambiguous no-secret CI job can count as success',()=>{
 const x=exactSafetyProof();
 const modifications=[
  a=>{a.jobs.jobs[0].conclusion='skipped';},
  a=>{a.jobs.jobs[0].conclusion='failure';},
  a=>{a.jobs.jobs[1].conclusion='success';},
  a=>{a.jobs.jobs[0].head_sha='c'.repeat(40);},
  a=>{a.jobs.jobs[0].run_id=0;},
  a=>{a.jobs.jobs[0].run_attempt=2;},
  a=>{a.jobs.jobs[0].name='Decorative green check';},
  a=>{a.jobs.total_count=3;},
  a=>{a.jobs.jobs.pop();},
  a=>{a.jobs.jobs[0].status='in_progress';}
 ];
 for(const mutate of modifications){
  const a=structuredClone(x);mutate(a);
  assert.throws(()=>verifyExactReviewedSafetyCi(a),
   /jobs unavailable|not proven successful/);
 }
});
test('Build150 protected manual runner uses read-only exact-head Actions checks before credential access',()=>{
 const gate=readFileSync(new URL('./independent-release-approval.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../.github/workflows/nonprod-synthetic-auth-uat.yml',import.meta.url),'utf8');
 assert(gate.includes("'event=pull_request&head_sha='+safeSha+'&per_page=100'"));
 assert(gate.includes("'/actions/runs/'+latest.id+'/jobs?filter=latest&per_page=100'"));
 assert(gate.includes('verifyExactReviewedSafetyCi({pr,runs,jobs})'));
 assert(workflow.includes('actions: read'));
 assert(workflow.indexOf('run: node security/nonprod-auth-uat/independent-release-approval.mjs')<
  workflow.indexOf('AMF_UAT_SERVICE_ROLE_KEY:'));
});
