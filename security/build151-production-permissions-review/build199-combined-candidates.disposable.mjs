/**
 * Build199: integration of THREE distinct review-only security candidates
 * with the exact original full 35-policy SQL and PR23's corrected has_role.
 * Candidates were already applied in the prior Build196+Build198 stages of
 * this same GoTrue-issued JWT/PostgREST DISPOSABLE PostgreSQL 17 database.
 * No company-hosted SQL, service keys, personal records or release approval.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const env=process.env;
assert(env.B195_DISPOSABLE_ONLY==='true'&&env.PGHOST==='127.0.0.1'&&
 env.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&
 env.PGUSER==='postgres'&&env.PGPASSWORD==='synthetic-disposable-only',
 'Build199 refuses any non-disposable database');
const root='security/build151-production-permissions-review/';
const reviewSources=[
 ['build196-notification-role-required.REVIEW-ONLY.sql.txt','9100d89d6f63316fac798cd50e29070642649cc8'],
 ['build198-caller-bound-get-user-role.REVIEW-ONLY.sql.txt','54c61175b92ede5cc9a010abc4a30545103f35cf'],
 ['build198-caller-bound-is-approved.REVIEW-ONLY.sql.txt','0765668ec71d066a6e78dfd3bef25556690bb742']
];
for(const [path,expected] of reviewSources){
 const content=readFileSync(new URL(path,import.meta.url),'utf8');
 const sha=createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex');
 assert.equal(sha,expected,'Build199 review-only candidate source drift '+path);
}
console.log('BUILD199_THREE_SEPARATE_REVIEW_CANDIDATE_SOURCE_BLOBS_PINNED');
const prefix='http://127.0.0.1:3000';
function uuid(v){
 assert.match(v,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 return "'"+v+"'::uuid";
}
function sql(statement){
 const guard="DO $b199$ BEGIN IF current_database()<>'amf_build195_gotrue_35_policy_lab' "+
  "OR session_user<>'postgres' THEN RAISE EXCEPTION 'Build199 non-disposable operation refused'; END IF; END $b199$;";
 const r=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',guard+'\n'+statement],{
  env,encoding:'utf8',timeout:20000
 });
 assert.equal(r.status,0,'Build199 synthetic-only SQL failure '+String(r.stderr).slice(0,360));
 return r.stdout.trim().split(/\r?\n/).at(-1);
}
async function httpRpc(name,fn,target,tokens){
 const headers={'Content-Type':'application/json',Accept:'application/json'};
 if(name!==null)headers.Authorization='Bearer '+tokens[name];
 const r=await fetch(prefix+'/rpc/'+fn,{method:'POST',headers,
  body:JSON.stringify({_user_id:target}),signal:AbortSignal.timeout(8000)});
 const text=await r.text();let body;
 try{body=JSON.parse(text)}catch{body=text}
 return {status:r.status,result:body};
}
export async function runBuild199({uids,tokens,query,rpc,mutation,yes}){
 let tests=0;
 const check=(id,predicate,value)=>{yes(id,predicate,value);tests++;};
 const own=uids.recruiterA,foreign=uids.admin;
 const userRole=(actor,id)=>httpRpc(actor,'get_user_role',id,tokens);
 const approved=(actor,id)=>httpRpc(actor,'is_approved',id,tokens);
 // Verify all original review candidates exist simultaneously.
 const sourceGate=readFileSync(new URL('build198-lookup-functions-fingerprint.readonly.sql',import.meta.url),'utf8');
 const source=sql(sourceGate);
 assert.equal(source.split('|').at(-1),'HOLD_LOOKUP_HELPER_DEFINITION_DRIFT');
 const policyGate=readFileSync(new URL('build192-exact-35-policy-fingerprint.readonly.sql',import.meta.url),'utf8');
 const policy=sql(policyGate);
 assert.equal(policy.split('|').at(-1),'HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT');
 const signals=sql(
  "SELECT count(*)=2 FROM pg_catalog.pg_policies WHERE schemaname='public' "+
  "AND tablename='notifications' AND policyname IN ('notifications_read','notifications_update') "+
  "AND qual LIKE '%EXISTS%'");
 assert.equal(signals,'t','Notification policy candidate must remain active');
 console.log('BUILD199_COMBINED_CANDIDATE_SOURCE_FINGERPRINTS_EXPECTED_HOLD');

 // Approved admin/recruiter/finance and pending user still have proper RLS.
 let v=await query('admin','candidates');
 check('B199_ADMIN_CANDIDATE_MATRIX',v.status===200&&v.count===3,v);
 v=await query('recruiterA','candidates');
 check('B199_RECRUITER_ASSIGNED_ROWS',v.status===200&&v.count===2,v);
 v=await query('finance','billing');
 check('B199_FINANCE_BILLING_READ',v.status===200&&v.count===1,v);
 v=await query('finance','candidates');
 check('B199_FINANCE_CANDIDATES_DENIED',v.status===200&&v.count===0,v);
 v=await query('pending','candidates');
 check('B199_PENDING_ADMIN_CANDIDATES_DENIED',v.status===200&&v.count===0,v);
 v=await query('recruiterA','notifications');
 check('B199_APPROVED_ACTIVE_NOTIFICATIONS_ALLOWED',v.status===200&&v.count===1,v);
 v=await userRole('recruiterA',own);
 check('B199_SELF_ROLE_LOOKUP_AFTER_ALL_PATCHES',v.status===200&&v.result==='recruiter',v);
 v=await approved('recruiterA',own);
 check('B199_SELF_APPROVAL_AFTER_ALL_PATCHES',v.status===200&&v.result===true,v);
 v=await userRole('recruiterA',foreign);
 check('B199_FOREIGN_ROLE_LOOKUP_BLOCKED',v.status===200&&v.result===null,v);
 v=await approved('recruiterA',foreign);
 check('B199_FOREIGN_APPROVAL_LOOKUP_BLOCKED',v.status===200&&v.result===false,v);
 v=await approved('admin',own);
 check('B199_ADMIN_CROSS_USER_APPROVAL_UNAVAILABLE_REVIEW_CALLERS',v.status===200&&v.result===false,v);
 v=await rpc('recruiterA',own,'recruiter');
 check('B199_PR23_CALLER_BOUND_ROLE_HELPER_TRUE',v.status===200&&v.result===true,v);
 v=await userRole(null,foreign);
 check('B199_ANON_GET_ROLE_RPC_DENIED',[401,403].includes(v.status),v);
 v=await approved(null,foreign);
 check('B199_ANON_APPROVAL_RPC_DENIED',[401,403].includes(v.status),v);
 const fakeNotification="'f1000000-0000-4000-8000-000000000001'::uuid";
 // Force a known state before testing a legitimate UPDATE then revoked UPDATE.
 sql("UPDATE public.notifications SET is_read=false WHERE id="+fakeNotification+";");
 v=await mutation('recruiterA','PATCH','notifications',{is_read:true},
  '?id=eq.f1000000-0000-4000-8000-000000000001');
 const persisted=sql("SELECT is_read FROM public.notifications WHERE id="+fakeNotification+";");
 check('B199_STAFF_NOTIFICATION_WRITE_STILL_WORKS',
  [200,204].includes(v.status)&&persisted==='t',{status:v.status,persisted});

 // Same VALID GoTrue JWT after authoritative role deletion.
 sql("DELETE FROM public.user_roles WHERE user_id="+uuid(own)+
  " AND role='recruiter'::public.app_role;");
 v=await query('recruiterA','candidates');
 check('B199_ROLE_REVOKED_CANDIDATES_HIDDEN',v.status===200&&v.count===0,v);
 v=await query('recruiterA','notifications');
 check('B199_ROLE_REVOKED_NOTIFICATIONS_HIDDEN',v.status===200&&v.count===0,v);
 v=await userRole('recruiterA',own);
 check('B199_ROLE_REVOKED_SELF_LOOKUP_NULL',v.status===200&&v.result===null,v);
 v=await approved('recruiterA',own);
 check('B199_ROLE_REVOKED_APPROVAL_STILL_TRUE',
  v.status===200&&v.result===true,v);
 v=await rpc('recruiterA',own,'recruiter');
 check('B199_ROLE_REVOKED_HAS_ROLE_FALSE',v.status===200&&v.result===false,v);
 v=await mutation('recruiterA','PATCH','notifications',{is_read:false},
  '?id=eq.f1000000-0000-4000-8000-000000000001');
 const afterAttempt=sql("SELECT is_read FROM public.notifications WHERE id="+fakeNotification+";");
 check('B199_ROLE_REVOKED_NOTIFICATION_WRITE_NO_EFFECT',
  [200,204,401,403].includes(v.status)&&afterAttempt==='t',
  {status:v.status,persisted:afterAttempt});

 // Service-role direct EXECUTE grant does NOT preserve historical cross-user
 // lookups without a current user. Test consequence; may break workflows.
 const serviceStatements=[
  'BEGIN;',
  'SET LOCAL ROLE service_role;',
  "SELECT (public.get_user_role("+uuid(own)+") IS NULL AND "+
  "public.is_approved("+uuid(own)+") IS FALSE AND "+
  "public.has_role("+uuid(own)+",'recruiter'::public.app_role) IS FALSE)::text;",
  'ROLLBACK;'
 ].join('\n');
 const guard="DO $b199_guard$ BEGIN IF current_database()<>'amf_build195_gotrue_35_policy_lab' "+
  "OR session_user<>'postgres' THEN RAISE EXCEPTION 'Non-disposable'; END IF; END $b199_guard$;";
 const sr=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',guard+'\n'+serviceStatements],{
  env,encoding:'utf8',timeout:18000
 });
 assert.equal(sr.status,0,'Build199 service-only fixture '+String(sr.stderr).slice(0,220));
 check('B199_SERVICE_ROLE_WITHOUT_AUTH_SUBJECT_ALL_LOOKUPS_FAIL_CLOSED',
  /(?:^|\n)(?:t|true)(?:\r?\n|$)/.test(sr.stdout),{output:sr.stdout.slice(-110)});
 console.log('BUILD199_SERVICE_CALLER_COMPATIBILITY_HOLD_NO_SUBJECT');

 // Restore member, then validate RLS and both helper calls without new JWT.
 sql("INSERT INTO public.user_roles(id,user_id,role) VALUES("+
  "'a1000000-0000-4000-8000-000000000014'::uuid,"+uuid(own)+",'recruiter'::public.app_role);");
 v=await query('recruiterA','candidates');
 check('B199_ROLE_RESTORED_OWN_CANDIDATES',v.status===200&&v.count===2,v);
 v=await query('recruiterA','notifications');
 check('B199_ROLE_RESTORED_OWN_NOTIFICATIONS',v.status===200&&v.count===1,v);
 v=await userRole('recruiterA',own);
 check('B199_ROLE_RESTORED_SELF_LOOKUP',v.status===200&&v.result==='recruiter',v);

 sql("UPDATE public.profiles SET is_active=false WHERE id="+uuid(own)+";");
 v=await query('recruiterA','candidates');
 check('B199_INACTIVE_APPROVAL_BLOCKS_DATA',v.status===200&&v.count===0,v);
 v=await approved('recruiterA',own);
 check('B199_INACTIVE_APPROVAL_RPC_FALSE',v.status===200&&v.result===false,v);
 v=await query('recruiterA','notifications');
 check('B199_INACTIVE_NOTIFICATIONS_HIDDEN',v.status===200&&v.count===0,v);
 sql("UPDATE public.profiles SET is_active=true WHERE id="+uuid(own)+";");
 v=await query('recruiterA','candidates');
 check('B199_REACTIVATED_ROLE_DATA_VISIBLE',v.status===200&&v.count===2,v);
 v=await approved('recruiterA',own);
 check('B199_REACTIVATED_APPROVAL_TRUE',v.status===200&&v.result===true,v);
 sql("UPDATE public.profiles SET status='suspended'::public.user_status WHERE id="+uuid(own)+";");
 v=await approved('recruiterA',own);
 check('B199_SUSPENDED_APPROVAL_FALSE',v.status===200&&v.result===false,v);
 v=await query('recruiterA','candidates');
 check('B199_SUSPENDED_DATA_HIDDEN',v.status===200&&v.count===0,v);
 sql("UPDATE public.profiles SET status='approved'::public.user_status WHERE id="+uuid(own)+";");
 v=await approved('recruiterA',own);
 check('B199_REAPPROVED_SELF_TRUE',v.status===200&&v.result===true,v);
 assert.equal(tests,33,'All 33 Build199 combined review-only assertions must run');
 console.log('BUILD199_33_OF_33_COMBINED_UNAPPROVED_CANDIDATE_HTTP_AND_SERVICE_CHECKS_PASS');
}
