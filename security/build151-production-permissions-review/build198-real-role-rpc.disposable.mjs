/**
 * Build198: actual production get_user_role body inside the proposed PR16
 * 35-policy + PR23 full GoTrue JWT/PostgREST disposable lab.
 * Record originally exposed cross-user role data, test separated candidate.
 * Every identity/role is fictitious. Never interact with hosted databases.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const root='security/build151-production-permissions-review/';
const env=process.env;
assert(env.B195_DISPOSABLE_ONLY==='true'&&env.PGHOST==='127.0.0.1'&&
 env.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&
 env.PGUSER==='postgres'&&env.PGPASSWORD==='synthetic-disposable-only',
 'Build198 refuses non-disposable database');

function localSql(sql){
 const guard="DO $guard$ BEGIN IF current_database()<>'amf_build195_gotrue_35_policy_lab' "+
 "OR session_user<>'postgres' THEN RAISE EXCEPTION 'Build198 non-disposable DB'; END IF; END $guard$;";
 const run=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',guard+'\n'+sql],
  {env,encoding:'utf8',timeout:15000});
 assert.equal(run.status,0,'Build198 disposable source check '+String(run.stderr).slice(0,280));
 return run.stdout.trim().split(/\r?\n/).at(-1);
}
async function remoteRpc(name,uid,tokens){
 const headers={'Content-Type':'application/json','Accept':'application/json'};
 if(name!==null)headers.Authorization='Bearer '+tokens[name];
 const resp=await fetch('http://127.0.0.1:3000/rpc/get_user_role',{
  method:'POST',headers,body:JSON.stringify({_user_id:uid}),
  signal:AbortSignal.timeout(7000)});
 const t=await resp.text();let value;
 try{value=JSON.parse(t)}catch{value=t}
 return {status:resp.status,result:value};
}
export async function runBuild198({uids,tokens,yes}){
 const requested=async (actor,who)=>remoteRpc(actor,who===null?null:uids[who],tokens);
 // Unchanged production function body still has an arbitrary _user_id arg.
 // PR16 revokes anonymous EXECUTE, but grants authenticated EXECUTE.
 const before=localSql("SELECT md5(pg_get_functiondef(oid)) FROM pg_proc "+
 "WHERE oid=to_regprocedure('public.get_user_role(uuid)');");
 assert.match(before,/^[0-9a-f]{32}$/);
 console.log('BUILD198_ORIGINAL_LIVE_SOURCE_ROLE_LOOKUP_DIGEST_DISPOSABLE_ONLY '+before);
 let v=await requested('recruiterA','recruiterA');
 yes('B198_ORIGINAL_RECRUITER_OWN_ROLE',v.status===200&&v.result==='recruiter',v);
 v=await requested('recruiterA','admin');
 yes('B198_ORIGINAL_RECRUITER_CAN_READ_FOREIGN_ADMIN_ROLE',
     v.status===200&&v.result==='admin',v);
 v=await requested('admin','recruiterA');
 yes('B198_ORIGINAL_ADMIN_CAN_READ_FOREIGN_RECRUITER_ROLE',
     v.status===200&&v.result==='recruiter',v);
 v=await requested('finance','finance');
 yes('B198_ORIGINAL_FINANCE_OWN_ROLE',v.status===200&&v.result==='finance',v);
 v=await requested('pending','pending');
 yes('B198_ORIGINAL_PENDING_SELF_ROLE_NOT_BUSINESS_AUTH',
     v.status===200&&v.result==='admin',v);
 v=await requested(null,'admin');
 yes('B198_PROPOSED_PR16_ANON_ROLE_RPC_DENIED',
    [401,403].includes(v.status),v);
 console.log('BUILD198_ORIGINAL_DRAFT_AUTHENTICATED_FOREIGN_ROLE_LOOKUP_GAP_REPRODUCED');

 // This SQL is NOT an authorized production/company policy. It is source-
 // separate, reviewed only after original behavior is evidenced.
 const overlay=readFileSync(new URL('./build198-caller-bound-get-user-role.REVIEW-ONLY.sql.txt',import.meta.url),'utf8');
 assert.match(overlay,/REVIEW-ONLY CANDIDATE/);
 assert.match(overlay,/current_database\(\)<>'amf_build195_gotrue_35_policy_lab'/);
 localSql(overlay);
 const after=localSql("SELECT md5(pg_get_functiondef(oid)) FROM pg_proc "+
 "WHERE oid=to_regprocedure('public.get_user_role(uuid)');");
 assert.match(after,/^[0-9a-f]{32}$/);
 assert.notEqual(after,before,'Build198 overlay must change function definition');
 const config=localSql("SELECT coalesce(array_to_string(proconfig,','),'') "+
 "FROM pg_proc WHERE oid=to_regprocedure('public.get_user_role(uuid)');");
 assert.ok(config==='search_path='||config==='search_path=""','Unexpected hardened function search_path: '+config);
 const anon=localSql("SELECT has_function_privilege('anon',"+
 "'public.get_user_role(uuid)','EXECUTE')");
 assert.equal(anon,'f');
 console.log('BUILD198_CANDIDATE_ROLE_HELPER_SOURCE_CHANGED_PENDING_REVIEW');

 v=await requested('recruiterA','recruiterA');
 yes('B198_CANDIDATE_RECRUITER_OWN_ROLE_PRESERVED',
  v.status===200&&v.result==='recruiter',v);
 v=await requested('recruiterA','admin');
 yes('B198_CANDIDATE_RECRUITER_FOREIGN_ADMIN_ROLE_NULL',
  v.status===200&&v.result===null,v);
 v=await requested('admin','recruiterA');
 yes('B198_CANDIDATE_ADMIN_CROSS_USER_LOOKUP_NULL_REVIEW_CALLERS',
  v.status===200&&v.result===null,v);
 v=await requested('admin','admin');
 yes('B198_CANDIDATE_ADMIN_SELF_ROLE_PRESERVED',
  v.status===200&&v.result==='admin',v);
 v=await requested('finance','finance');
 yes('B198_CANDIDATE_FINANCE_SELF_ROLE_PRESERVED',
  v.status===200&&v.result==='finance',v);
 v=await requested('pending','pending');
 yes('B198_CANDIDATE_PENDING_RAW_SELF_ROLE_NOT_APPROVAL',
  v.status===200&&v.result==='admin',v);
 v=await requested('admin',null);
 yes('B198_CANDIDATE_NULL_TARGET_NULL',
  v.status===200&&v.result===null,v);
 v=await requested(null,'admin');
 yes('B198_CANDIDATE_ANON_FUNCTION_EXECUTE_DENIED',
  [401,403].includes(v.status),v);
 console.log('BUILD198_14_OF_14_ROLE_LOOKUP_ORIGINAL_AND_CANDIDATE_CASES_PASS_DISPOSABLE_ONLY');
}
