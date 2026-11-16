import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildPolicyImpact,renderPolicyImpact} from './policy-impact.mjs';

import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// REVIEW-ONLY: no database driver, network access, or SQL execution.
const dir=dirname(fileURLToPath(import.meta.url));
const load=name=>readFileSync(resolve(dir,name),'utf8');
const manifest=JSON.parse(load('source-manifest.json'));
const inventory=JSON.parse(load('baseline-48.json'));
const preflight=load('production-preflight.readonly.sql');
const draft=load('lockdown.DO-NOT-APPLY.review.sql');
const rehearsal=load('disposable-rehearsal.DO-NOT-RUN.sql.txt');
const blobSha=text=>createHash('sha1')
  .update('blob '+Buffer.byteLength(text,'utf8')+'\0').update(text,'utf8')
  .digest('hex');
const between=(s,start,end)=>{
  const from=s.indexOf(start);
  assert(from>=0,'Missing expected SQL start '+start);
  const to=s.indexOf(end,from+start.length);
  assert(to>from,'Missing expected SQL end '+end);
  return s.slice(from+start.length,to);
};
const sqlValueNames=part=>[...part.matchAll(/\('([^']+)'\)/g)].map(m=>m[1]);

test('Build152 all ten source artifacts match original PR12 Git blob hashes',()=>{
 assert.equal(manifest.source_pr,12);
 assert.match(manifest.source_pr_head,/^[0-9a-f]{40}$/);
 assert.equal(manifest.original_sources.length,10);
 assert.equal(new Set(manifest.original_sources.map(x=>x.review_copy)).size,10);
 for(const source of manifest.original_sources){
  const local=source.review_copy.split('/').at(-1);
  assert.equal(source.review_copy,'security/build151-production-permissions-review/'+local);
  assert.match(source.source_path,/^security\/build(?:47|48|49|73|74)\//);
  assert.equal(blobSha(load(local)),source.source_blob_sha,'Source drift: '+local);
 }
});
test('Build151 preflight enumerates exact approved 19 tables, 13 views and 16 function signatures',()=>{
 assert.deepEqual(
  sqlValueNames(between(preflight,"WITH expected_tables(name) AS (VALUES", "), expected_views(name) AS (VALUES")),
  inventory.objects.tables
 );
 assert.deepEqual(
  sqlValueNames(between(preflight,"), expected_views(name) AS (VALUES", "), expected_functions(signature) AS (VALUES")),
  inventory.objects.views
 );
 const f=sqlValueNames(between(preflight,"), expected_functions(signature) AS (VALUES", "), tab AS ("));
 assert.equal(f.length,16);
 assert.equal(new Set(f).size,16);
 assert.deepEqual(f.map(x=>x.replace(/^public\./,'').replace(/public\.app_role/g,'app_role').split('(')[0]),
  inventory.objects.functions);
 assert.deepEqual(
  [inventory.objects.tables.length,inventory.objects.views.length,inventory.objects.functions.length],
  [19,13,16]
 );
 assert.equal(manifest.expected_catalog.security_objects,48);
});
test('Build151 diagnostic is single SELECT and cannot mutate a hosted DB',()=>{
 assert.match(preflight,/^-- Build73 READ-ONLY catalog-only 48-object permission preflight/);
 assert.match(preflight,/^WITH expected_tables\(name\) AS \(VALUES/m);
 assert.match(preflight,/FROM aggregate;\s*$/);
 assert.equal((preflight.match(/;/g)||[]).length,1);
 assert.doesNotMatch(preflight,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(preflight,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
});
test('Build151 prospective production changes remain a DRAFT, never a managed migration',()=>{
 assert.match(draft,/REVIEW-ONLY: 48-object anonymous privilege lockdown/);
 assert.match(draft,/DO NOT RUN in production\/staging/);
 assert.match(draft,/\bBEGIN;/);
 assert.match(draft,/\bCOMMIT;/);
 assert.match(draft,/REVOKE\s/i);
 assert.match(draft,/ALTER VIEW/i);
 assert.match(draft,/DROP POLICY/i);
 for(const n of [19,13,16])assert(draft.includes('IF n<>'+n),'Missing preflight object guard '+n);
 assert.equal(manifest.acceptance.approved_for_execution,false);
 assert.equal(manifest.acceptance.production_remediations_applied,0);
 assert.equal(manifest.acceptance.independently_accepted,0);
 assert.equal(manifest.acceptance.total,48);
});
test('Build151 disposable rehearsal must refuse any database except exact lab and ROLLBACK',()=>{
 assert.match(rehearsal,/current_database\(\)<>'amf_build73_permissions_lab'/);
 assert.match(rehearsal,/BEGIN;/);
 assert.match(rehearsal,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(rehearsal,/(^|\n)COMMIT;\s*(\n|$)/);
 assert.match(rehearsal,/DISPOSABLE PostgreSQL 17 ONLY/);
});
test('Build151 live-readonly baseline is correctly marked HOLD, not accepted',()=>{
 const x=manifest.live_readonly_observation_2026_11_15;
 assert.equal(x.project_ref,'wusntntcqgtpgokggdzv');
 assert.equal(x.permission_preflight,'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT');
 assert.equal(x.matched_tables,19);
 assert.equal(x.anon_truncate_tables,19);
 assert.equal(x.authenticated_truncate_tables,19);
 assert.equal(x.security_invoker_views,0);
 assert.equal(x.anon_readable_views,13);
 assert.equal(x.anon_executable_privileged_functions,16);
 assert.equal(x.public_executable_privileged_functions,9);
 assert.equal(x.rows_queried,0);
 assert.equal(x.writes,0);
});
test('Build151 independently reviewable package cannot be misconstrued as release approval',()=>{
 const readme=load('README.md');
 assert.match(readme,/DO NOT EXECUTE|DO NOT APPLY/);
 assert.match(readme,/0\/48/);
 assert.match(readme,/independent/i);
 assert.match(readme,/RLS|polic/i);
 assert.match(readme,/PITR|restore/i);
 assert.match(readme,/not.*production deploy/i);
 assert(!manifest.original_sources.some(x=>x.review_copy.startsWith('supabase/migrations/')));
});


// Build152: full RLS/catalog and account RPC review sources are copied from
// PR12 as inert .sql.txt files. Never invoke a SQL execution engine in CI.
const policyCatalog=JSON.parse(load('baseline-67-policies.json'));
const policyReplay=load('legacy-67-policies.DO-NOT-RUN.sql.txt');
const fullPolicyProposal=load('complete-67-to-35-with-rpcs.DO-NOT-APPLY.sql.txt');
const adminProposal=load('admin-account-rpc.DO-NOT-APPLY.sql.txt');
const selfProposal=load('self-profile-rpc.DO-NOT-APPLY.sql.txt');
const priorFingerprints=JSON.parse(load('prior-source-fingerprints.json'));
const policyPreflight=load('policy-fingerprint.readonly.sql');

test('Build152 exact existing 67-policy catalog covers 18 tables and has 15 permissive ALL bypasses',()=>{
 assert.equal(policyCatalog.count,67);
 assert.equal(policyCatalog.tables,18);
 assert.equal(policyCatalog.policies.length,67);
 assert.equal(new Set(policyCatalog.policies.map(p=>p.tablename)).size,18);
 const names=policyCatalog.policies.map(p=>p.tablename+'/'+p.policyname);
 assert.equal(new Set(names).size,67);
 const broad=policyCatalog.policies.filter(p=>
  p.policyname==='Allow all for authenticated'&&p.permissive==='PERMISSIVE'&&
  p.roles==='{public}'&&p.cmd==='ALL'&&p.qual==='true'&&p.with_check==='true');
 assert.equal(broad.length,15);
 assert.equal((policyReplay.match(/^CREATE POLICY /gm)||[]).length,67);
 assert.doesNotMatch(policyReplay,/^BEGIN;|^COMMIT;/m);
});
test('Build152 independent JavaScript digest reproduces live PostgreSQL pg_policies fingerprint',()=>{
 // pg_policies source view uses PostgreSQL's catalog/C name collation;
 // localeCompare('en') would reorder uppercase "Allow all" after lowercase
 // policy names for five tables and falsely signal a policy source drift.
 const binaryCompare=(x,y)=>x===y?0:(x<y?-1:1);
 const sorted=[...policyCatalog.policies].sort((a,b)=>
  binaryCompare(a.tablename,b.tablename)||binaryCompare(a.policyname,b.policyname));
 const value=sorted.map(p=>
  [p.tablename,p.policyname,p.permissive,p.roles,p.cmd,
   p.qual??'<NULL>',p.with_check??'<NULL>'].join('\x1f')).join('\n');
 const digest=createHash('md5').update(value,'utf8').digest('hex');
 assert.equal(digest,'a70190f31ed8436b2989082898a02b51');
 assert.equal(digest,manifest.live_readonly_policy_observation_2026_11_15.observed_policy_md5);
 assert.equal(priorFingerprints.checks.find(x=>x.scope==='existing_public_rls_policies').observed_md5,digest);
});
test('Build152 full proposed 67-to-35 policy replacement and account RPCs are present, inactive',()=>{
 assert.match(fullPolicyProposal,/exact 67-policy replacement/);
 assert.equal((fullPolicyProposal.match(/^CREATE POLICY /gm)||[]).length,35);
 assert.match(fullPolicyProposal,/digest<>'a70190f31ed8436b2989082898a02b51'/);
 assert.match(fullPolicyProposal,/CREATE OR REPLACE FUNCTION public\.crm_admin_manage_user/);
 assert.match(fullPolicyProposal,/CREATE OR REPLACE FUNCTION public\.crm_update_own_profile/);
 assert.match(adminProposal,/v_actor uuid := auth\.uid\(\)/);
 assert.match(adminProposal,/SECURITY DEFINER SET search_path=pg_catalog,public/);
 assert.match(selfProposal,/SECURITY DEFINER SET search_path=pg_catalog,public/);
 assert.equal(manifest.acceptance.full_rls_policy_replacement_applied,false);
 assert.equal(manifest.acceptance.full_rls_policy_replacement_accepted,false);
 assert.equal(manifest.acceptance.production_remediations_applied,0);
 assert.equal(manifest.acceptance.independently_accepted,0);
});
test('Build152 all executable-looking production policy proposals are archived as text not migrations',()=>{
 const sqlSources=manifest.original_sources.filter(x=>
  /67-policy-replay|67-policy-plus-account-rpcs|user-admin-rpc|self-profile-rpc/.test(x.source_path));
 assert.equal(sqlSources.length,4);
 assert(sqlSources.every(x=>x.review_copy.endsWith('.sql.txt')));
 assert(manifest.original_sources.every(x=>!x.review_copy.startsWith('supabase/migrations/')));
 const readme=load('README.md');
 assert.match(readme,/DO NOT APPLY/i);
 assert.match(readme,/67-policy/);
 assert.match(readme,/35 proposed/i);
 assert.match(readme,/not a deployable migration/i);
});
test('Build152 policy fingerprint preflight is catalog-only and contains no writes',()=>{
 assert.match(policyPreflight,/^-- Build152 READ ONLY/);
 assert.match(policyPreflight,/\bFROM pg_catalog\.pg_policies\b/);
 assert.match(policyPreflight,/SOURCE_MATCH_REVIEW_ONLY_RELEASE_HOLD/);
 assert.match(policyPreflight,/SOURCE_DRIFT_RELEASE_HOLD/);
 assert.equal((policyPreflight.match(/;/g)||[]).length,1);
 assert.doesNotMatch(policyPreflight,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(policyPreflight,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
 assert.equal(manifest.live_readonly_policy_observation_2026_11_15.release_decision,
  'SOURCE_MATCH_REVIEW_ONLY_RELEASE_HOLD');
});
test('Build152 policy review is separate from 48-object permission changes and business acceptance',()=>{
 assert.equal(manifest.expected_catalog.security_objects,48);
 assert.equal(manifest.acceptance.total,48);
 assert.equal(manifest.acceptance.approved_for_execution,false);
 assert.equal(manifest.live_readonly_policy_observation_2026_11_15.actual_business_rows_queried,0);
 assert.equal(manifest.live_readonly_policy_observation_2026_11_15.production_writes,0);
 assert.equal(manifest.live_readonly_observation_2026_11_15.permission_preflight,
  'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT');
});


// Build153: table-by-table source impact accounting for review, not SQL access.
test('Build153 committed impact report and JSON are deterministically generated from pinned inputs',()=>{
 const built=buildPolicyImpact(policyCatalog,fullPolicyProposal);
 assert.deepEqual(JSON.parse(load('policy-impact.json')),built);
 assert.equal(load('POLICY_IMPACT_MATRIX.md'),renderPolicyImpact(built));
});
test('Build153 compares all 19 tables, 67 legacy and 35 proposed declarations exactly',()=>{
 const impact=buildPolicyImpact(policyCatalog,fullPolicyProposal);
 assert.deepEqual(impact.summary,{
  legacy_policies:67,proposed_policies:35,legacy_tables:18,
  proposed_tables:19,reviewed_tables:19,removed_universal_all_policies:15,
  tables_with_removed_declared_operations:7,
  tables_with_added_declared_operations:1,
  production_fixes_applied:0,owner_signed_tables:0
 });
 assert.equal(new Set(impact.tables.map(x=>x.table)).size,19);
 assert(impact.tables.every(x=>x.owner_acceptance==='NOT_RECEIVED'));
 assert(impact.tables.every(x=>x.suggested_reviewer&&x.suggested_uat));
});
test('Build153 audit and workflow logging write-risk cases are explicit in matrix',()=>{
 const impact=buildPolicyImpact(policyCatalog,fullPolicyProposal);
 for(const table of ['audit_logs','candidate_activities','email_log','sync_logs']){
  const row=impact.tables.find(x=>x.table===table);
  assert(row.removed_policy_command_declarations.includes('INSERT'),table+' must flag INSERT change');
  assert.equal(row.priority,'HIGH');
 }
 const settings=impact.tables.find(x=>x.table==='app_settings');
 assert(settings.removed_policy_command_declarations.includes('UPDATE'));
 const notifications=impact.tables.find(x=>x.table==='notifications');
 assert(notifications.removed_policy_command_declarations.includes('DELETE'));
 const history=impact.tables.find(x=>x.table==='candidate_stage_history');
 assert.equal(history.legacy_policy_count,0);
 assert.deepEqual(history.new_policy_command_declarations,['SELECT']);
});
test('Build153 impact parser rejects missing or duplicated SQL policy statements',()=>{
 assert.throws(()=>buildPolicyImpact(policyCatalog,fullPolicyProposal.replace(
  /^CREATE POLICY profile_read .*$/m,'-- intentionally removed for negative test')),
  /Proposed policy count/);
 assert.throws(()=>buildPolicyImpact(policyCatalog,fullPolicyProposal.replace(
  /^CREATE POLICY profile_read .*$/m,'CREATE POLICY profile_admin_update ON public.profiles FOR SELECT TO authenticated')),
  /not unique/);
 assert.throws(()=>buildPolicyImpact({...policyCatalog,count:66},fullPolicyProposal),
  /Legacy 67-policy catalog/);
});
test('Build153 README and impact report explicitly refuse deploy inference',()=>{
 const report=load('POLICY_IMPACT_MATRIX.md'),readme=load('README.md');
 assert.match(report,/HOLD/);
 assert.match(report,/not actual SQL privileges/i);
 assert.match(report,/140 cases/);
 assert.match(readme,/Build 153/);
 assert.match(readme,/not an authorization/i);
 assert.equal(manifest.acceptance.approved_for_execution,false);
});


// Build154: source snapshots make CRM/RLS compatibility evidence reproducible
// without GitHub API requests, mail providers, database clients or credentials.
const runtimeEvidence=JSON.parse(load('runtime-code-evidence.json'));
const runtimeSource=path=>{
 const source=runtimeEvidence.source_files.find(s=>s.source_path===path);
 assert(source,'Missing source trace for '+path);
 return load('runtime-sources/'+source.review_copy.split('/').at(-1));
};
test('Build154 ten CRM source snapshots match original PR12 Git blob hashes',()=>{
 assert.equal(runtimeEvidence.source_pr,12);
 assert.equal(runtimeEvidence.source_files.length,10);
 assert.equal(new Set(runtimeEvidence.source_files.map(s=>s.source_path)).size,10);
 for(const source of runtimeEvidence.source_files){
  assert.match(source.source_blob_sha,/^[a-f0-9]{40}$/);
  assert(source.review_copy.endsWith('.source.txt'));
  assert.equal(blobSha(runtimeSource(source.source_path)),source.source_blob_sha,
   'CRM source drift: '+source.source_path);
  assert.equal(source.provenance_sha,runtimeEvidence.source_pr_head);
 }
});
test('Build154 exact line anchors match original immutable CRM code',()=>{
 assert.equal(runtimeEvidence.traces.length,13);
 for(const trace of runtimeEvidence.traces){
  const source=runtimeEvidence.source_files.find(s=>s.source_path===trace.source_path);
  assert(source);
  assert.equal(trace.source_blob_sha,source.source_blob_sha);
  assert(runtimeSource(trace.source_path).split('\n')[trace.line-1].includes(trace.needle),
   'CRM evidence location drifted: '+trace.id);
 }
 assert.equal(new Set(runtimeEvidence.traces.map(t=>t.id)).size,13);
});
test('Build154 email send/log ordering is an explicit source-backed release blocker',()=>{
 const code=runtimeSource('src/lib/email.functions.ts');
 const send=code.indexOf('const result = await sendEmail({');
 const write=code.indexOf('context.supabase.from("email_log" as any).insert({');
 assert(send>=0&&write>send);
 const onLogError=code.indexOf('if (logError) {',write);
 const onSendError=code.indexOf('if (!result.success)',onLogError);
 assert(onSendError>onLogError);
 assert.doesNotMatch(code.slice(onLogError,onSendError),/\bthrow\b/);
 const row=JSON.parse(load('policy-impact.json')).tables.find(x=>x.table==='email_log');
 assert(row.removed_policy_command_declarations.includes('INSERT'));
 const finding=runtimeEvidence.risk_register.find(x=>x.id==='R154-01');
 assert.equal(finding.priority,'RELEASE_BLOCKER');
 assert(finding.source_refs.includes('email-log-user-scoped-write'));
});
test('Build154 trusted sync logging is not mistakenly classified as ordinary browser logging',()=>{
 const sync=runtimeSource('src/lib/sheets-sync.server.ts');
 const admin=runtimeSource('src/integrations/supabase/client.server.ts');
 assert.equal(sync.split('await supabaseAdmin.from("sync_logs").insert({').length-1,2);
 assert(admin.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert(admin.includes('createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'));
 const row=JSON.parse(load('policy-impact.json')).tables.find(x=>x.table==='sync_logs');
 assert(row.removed_policy_command_declarations.includes('INSERT'));
 assert.equal(runtimeEvidence.risk_register.find(x=>x.id==='R154-02').priority,'HIGH');
});
test('Build154 notification and role/account RPC paths are explicit independent UAT tests',()=>{
 assert(runtimeSource('src/routes/_app.notifications.tsx').includes('.update({ is_read: true }).eq("id", id).eq("user_id", userId)'));
 assert(runtimeSource('src/lib/admin-settings.ts').includes('rpcClient.rpc("crm_admin_update_setting"'));
 assert(runtimeSource('src/lib/user-administration.ts').includes('rpc.rpc("crm_admin_manage_user"'));
 assert(runtimeSource('src/lib/profile-settings.ts').includes('rpc.rpc("crm_update_own_profile"'));
 assert(runtimeSource('src/lib/candidate-stage.ts').includes('rpc.rpc("crm_change_candidate_stage"'));
 const risks=runtimeEvidence.risk_register;
 assert.equal(risks.length,7);
 assert(risks.every(x=>x.uat_requirement&&x.owner_review&&x.source_refs.length));
 assert(risks.every(x=>x.source_refs.every(id=>runtimeEvidence.traces.some(t=>t.id===id))));
});
test('Build154 documentation is review-only and never counts as acceptance',()=>{
 assert.match(load('CRM_RUNTIME_COMPATIBILITY.md'),/release blocker/i);
 assert.match(load('CRM_RUNTIME_COMPATIBILITY.md'),/0\/140 signed hosted cases/);
 assert.match(load('README.md'),/Build 154/);
 assert.equal(runtimeEvidence.formal_acceptance,'HOLD_0_OF_48_PRODUCTION_FIXES');
 assert.equal(runtimeEvidence.execution,'NO_NETWORK_NO_DATABASE_NO_SEND_NO_DEPLOY');
 assert.equal(manifest.acceptance.approved_for_execution,false);
});


test('Build191 proposed 48-object postflight covers all unsafe DML/column grants and remains READ ONLY',()=>{
 const sql=load('build191-postflight.readonly.sql');
 const expected=inventory.objects;
 assert.match(sql,/BUILD191: READ-ONLY/);
 for(const name of expected.tables)assert(sql.includes("('"+name+"')"),name);
 for(const name of expected.views)assert(sql.includes("('"+name+"')"),name);
 for(const name of expected.functions)assert(sql.includes("public."+name+"("),name);
 for(const field of ['data_api_roles_bypassing_rls','public_schema_create_exposure','anon_table_grants','anon_unapproved_column_select',
 'anon_column_update','anon_branding_columns_select',
 'authenticated_high_risk_table_grants',
 'authenticated_direct_account_mutations',
 'anon_executable_privileged_functions',
 'publicly_granted_privileged_functions',
 'service_executable_privileged_functions','all_public_policies',
 'universal_public_all_policies','reviewed_admin_rpcs_present',
 'auth_admin_rpcs_callable','exposed_admin_rpcs'])
  assert(sql.includes(field),field);
 assert.match(sql,/has_column_privilege\(/);
 assert.match(sql,/has_table_privilege\(/);
 assert.match(sql,/REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE/);
 assert.match(sql,/HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE/);
 assert.equal((sql.match(/;\s*$/gm)||[]).length,1,'Must be exactly one executable SQL statement');
 const executable=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 assert.doesNotMatch(executable,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(executable,/\b(?:FROM|JOIN)\s+(?:public|auth)\.(?:user_roles|audit_logs|profiles|billing|candidates)\b/i);
});
test('Build191 PG17 disposable candidate checker detects 25 unsafe permission/policy defects and always rolls back',()=>{
 const script=load('build191-postflight-disposable.pg17.sql');
 const workflow=readFileSync(resolve(dir,'../../.github/workflows/build151-production-permission-review.yml'),'utf8');
 assert.match(script,/DISPOSABLE PostgreSQL17 ONLY/);
 assert.match(script,/^BEGIN;$/m);
 assert.match(script,/^ROLLBACK;$/m);
 assert.match(script,/BUILD191_FULL_CATALOG_ROLLBACK_VERIFIED/);
 assert.match(script,/BUILD191_CATALOG_SHAPE_MATCH_IS_REVIEW_ONLY_NOT_REAL_AUTHORIZATION/);
 assert.match(script,/BUILD191_SAFE_FIXTURE_RECOVERED_AFTER_25_ADVERSE_CASES/);
 for(let i=1;i<=25;i++)assert(script.includes('BUILD191_EXPECTED_HOLD_'+i),i);
 assert.equal((script.match(/^SAVEPOINT build191_adverse;/gm)||[]).length,25);
 assert.equal((script.match(/^ROLLBACK TO SAVEPOINT build191_adverse;/gm)||[]).length,25);
 assert.equal((script.match(/^RELEASE SAVEPOINT build191_adverse;/gm)||[]).length,25);
 assert.equal((script.match(/\\i \/tmp\/build191-postflight.gset.sql/g)||[]).length,27);
 assert.match(workflow,/proposed-postflight-pg17:/);
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/BUILD191_ONLY_DISPOSABLE_PG17_NO_HOSTED_WRITES/);
 assert.match(workflow,/python3 - <<'PY'/);
 assert.match(workflow,/build191-postflight-disposable\.pg17\.sql/);
});


test('Build192 actual proposal replay pins exact Git source blobs, withholds COMMIT, requires disposable PG17',()=>{
 const generator=load('build192-replay-actual-proposal.disposable.mjs');
 for(const name of ['disposable-rehearsal.DO-NOT-RUN.sql.txt',
   'legacy-67-policies.DO-NOT-RUN.sql.txt',
   'complete-67-to-35-with-rpcs.DO-NOT-APPLY.sql.txt',
   'build191-postflight.readonly.sql','policy-fingerprint.readonly.sql'])
  assert(generator.includes(name),name);
 for(const sha of ['858542a266e0052124b486610a3eac7266b63ddc',
 '59ac1f0d25215333868012fdb8e6b9382ed12e14',
 '484c251cdbfd932bdab5ffcf039a107e7478633e',
 '6815eebf2fb6fcc70cfc071bd499c98b73bdcc9e',
 '7c7185769033b22aeef9fcd5661874ae90329a71'])
  assert(generator.includes(sha),sha);
 assert.match(generator,/B192_DISPOSABLE_ONLY/);
 assert.match(generator,/amf_build192_full_policy_lab/);
 assert.match(generator,/PGHOST!=='127\.0\.0\.1'/);
 assert.match(generator,/proposal\.slice\(0,at\)/);
 assert.match(generator,/ROLLBACK;/);
 assert.match(generator,/BUILD192_ORIGINAL_67_POLICY_CATALOG_RESTORED/);
 assert.match(generator,/BUILD192_PROPOSED_ACCOUNT_RPCS_ROLLED_BACK/);
 const workflow=readFileSync(resolve(dir,'../../.github/workflows/build151-production-permission-review.yml'),'utf8');
 assert.match(workflow,/actual-source-policy-draft-rollback:/);
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/CREATE DATABASE amf_build192_full_policy_lab/);
 assert.match(workflow,/B192_DISPOSABLE_ONLY: 'true'/);
 assert.match(workflow,/BUILD192_ACTUAL_REVIEW_PROPOSAL_TESTED_DISPOSABLE_ONLY_NO_PRODUCTION_SQL/);
 assert(!/supabase\/migrations\/build192/.test(generator));
});


test('Build192 exact PostgreSQL-derived proposed 35-policy digest detects predicate-only drift',()=>{
 const sql=load('build192-exact-35-policy-fingerprint.readonly.sql');
 const gen=load('build192-replay-actual-proposal.disposable.mjs');
 assert.match(sql,/^-- BUILD192 READ ONLY:/);
 assert.match(sql,/FROM pg_catalog\.pg_policies WHERE schemaname='public'/);
 assert.match(sql,/actual_policy_count=35 AND actual_policy_tables=19/);
 assert.match(sql,/632d447f4cb5b5a88777e48916e288f9/);
 assert.match(sql,/REVIEW_ONLY_EXACT_35_POLICY_SOURCE_MATCH_NOT_RELEASE/);
 assert.match(sql,/HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT/);
 assert.equal((sql.match(/;\s*$/gm)||[]).length,1);
 const executable=sql.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
 assert.doesNotMatch(executable,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.match(gen,/41a08c33f3d423b5b3f0a4b91bffe8e2c97acd0e/);
 assert.match(gen,/ALTER POLICY candidates_read ON public\.candidates USING\(true\)/);
 assert.match(gen,/BUILD192_EXACT_POLICY_FINGERPRINT_CAUGHT_SAME_COUNT_PREDICATE_DRIFT/);
 assert.match(gen,/BUILD192_EXACT_35_POLICY_FINGERPRINT_RECOVERED/);
 assert.match(gen,/ROLLBACK TO SAVEPOINT b192_predicate_drift/);
 assert.match(gen,/BUILD192_ORIGINAL_67_POLICY_CATALOG_RESTORED/);
});
