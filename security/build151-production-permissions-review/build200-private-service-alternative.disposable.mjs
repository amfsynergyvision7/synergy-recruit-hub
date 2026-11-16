/**
 * Build200 disposable CI only: private SECURITY INVOKER lookups for service_role,
 * alongside denied public/user calls, with fictional GoTrue users and tables.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const e=process.env;
assert(e.B195_DISPOSABLE_ONLY==='true'&&e.PGHOST==='127.0.0.1'&&
 e.PGUSER==='postgres'&&e.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&
 e.PGPASSWORD==='synthetic-disposable-only','Build200 non-disposable target refused');
const candidate=readFileSync(new URL('./build200-internal-service-lookup.REVIEW-ONLY.sql.txt',import.meta.url),'utf8');
const sha=createHash('sha1').update('blob '+Buffer.byteLength(candidate)+'\0').update(candidate).digest('hex');
assert.equal(sha,'56fd30f7531b1303ef8f2ce26e3ec54471eb0403',
 'Review-only private helper source changed');
function uuid(v){
 assert.match(v,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 return "'"+v+"'::uuid";
}
function psql(sql,expectedFailure=false){
 const guard="DO $g$ BEGIN IF current_database()<>'amf_build195_gotrue_35_policy_lab' "+
 "OR session_user<>'postgres' THEN RAISE EXCEPTION 'Build200 only disposable'; END IF; END $g$;";
 const run=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',guard+'\n'+sql],{
  encoding:'utf8',env:e,timeout:18000
 });
 if(expectedFailure)assert.notEqual(run.status,0,'Expected permission denial');
 else assert.equal(run.status,0,'Disposable SQL failed: '+String(run.stderr).slice(0,300));
 return {stdout:run.stdout??'',stderr:run.stderr??'',status:run.status};
}
function select(sql,role=null){
 const statements=role?
  'BEGIN; SET LOCAL ROLE '+role+'; '+sql+'; ROLLBACK;':sql+';';
 const lines=psql(statements).stdout.split(/\r?\n/).map(x=>x.trim());
 return lines.find(x=>['admin','recruiter','finance','viewer','operations','true','false','t','f'].includes(x))??null;
}
async function apiPrivate(name,tokens){
 const h={Accept:'application/json','Content-Type':'application/json'};
 if(name!==null)h.Authorization='Bearer '+tokens[name];
 const res=await fetch('http://127.0.0.1:3000/rpc/staff_role',{
  method:'POST',headers:h,body:JSON.stringify({_user_id:'00000000-0000-0000-0000-000000000000'}),
  signal:AbortSignal.timeout(7000)});
 return {status:res.status,body:(await res.text()).slice(0,130)};
}
export async function runBuild200({uids,tokens,query,yes}){
 let cases=0;
 function check(label,ok,actual){yes(label,ok,actual);cases++;}
 psql(candidate);
 console.log('BUILD200_PINNED_PRIVATE_SERVICE_FUNCTIONS_INSTALLED_DISPOSABLE_ONLY');
 const catalog=select("SELECT (count(*)=2)::text FROM pg_catalog.pg_proc WHERE pronamespace='b200_review_internal'::regnamespace AND NOT prosecdef");
 check('B200_BOTH_PRIVATE_HELPERS_SECURITY_INVOKER',catalog==='true',{catalog});
 const serviceSchema=select("SELECT has_schema_privilege('service_role','b200_review_internal','USAGE')::text");
 check('B200_SERVICE_ROLE_PRIVATE_SCHEMA_USAGE',serviceSchema==='true',{serviceSchema});
 const anonSchema=select("SELECT has_schema_privilege('anon','b200_review_internal','USAGE')::text");
 check('B200_ANON_PRIVATE_SCHEMA_DENIED',anonSchema==='false',{anonSchema});
 const userSchema=select("SELECT has_schema_privilege('authenticated','b200_review_internal','USAGE')::text");
 check('B200_AUTHENTICATED_PRIVATE_SCHEMA_DENIED',userSchema==='false',{userSchema});
 const roleMember=select("SELECT pg_has_role('authenticated','service_role','MEMBER')::text");
 check('B200_AUTHENTICATED_CANNOT_ASSUMESERVICE',roleMember==='false',{roleMember});
 const serviceExec=select("SELECT has_function_privilege('service_role','b200_review_internal.staff_role(uuid)','EXECUTE')::text");
 check('B200_SERVICE_EXECUTE_GRANTED',serviceExec==='true',{serviceExec});
 const authExec=select("SELECT has_function_privilege('authenticated','b200_review_internal.staff_role(uuid)','EXECUTE')::text");
 check('B200_AUTHENTICATED_FUNCTION_EXECUTE_DENIED',authExec==='false',{authExec});
 const anonExec=select("SELECT has_function_privilege('anon','b200_review_internal.staff_approved(uuid)','EXECUTE')::text");
 check('B200_ANON_FUNCTION_EXECUTE_DENIED',anonExec==='false',{anonExec});
 const noSubject=select("SELECT (auth.uid() IS NULL)::text");
 check('B200_SERVICE_TEST_NO_AUTH_SUBJECT',noSubject==='true',{noSubject});
 const staffRole=id=>select('SELECT b200_review_internal.staff_role('+uuid(id)+')::text','service_role');
 const staffApproved=id=>select('SELECT b200_review_internal.staff_approved('+uuid(id)+')::text','service_role');
 for(const [who,want] of [
  ['admin','admin'],['recruiterA','recruiter'],['recruiterB','recruiter'],
  ['finance','finance'],['pending','admin']
 ]){
  const got=staffRole(uids[who]);
  check('B200_SERVICE_'+who.toUpperCase()+'_ROLE_READ',got===want,{got,want});
 }
 for(const [who,want] of [
  ['admin','true'],['recruiterA','true'],['recruiterB','true'],
  ['finance','true'],['pending','false']
 ]){
  const got=staffApproved(uids[who]);
  check('B200_SERVICE_'+who.toUpperCase()+'_APPROVAL_READ',got===want,{got,want});
 }
 const nullRole=select("SELECT (b200_review_internal.staff_role(NULL::uuid) IS NULL)::text",'service_role');
 check('B200_NULL_ROLE_TARGET_DENIED',nullRole==='true',{nullRole});
 const nullApproved=select("SELECT b200_review_internal.staff_approved(NULL::uuid)::text",'service_role');
 check('B200_NULL_APPROVAL_FALSE',nullApproved==='false',{nullApproved});
 for(const role of ['anon','authenticated']){
  const result=psql('BEGIN; SET LOCAL ROLE '+role+'; SELECT b200_review_internal.staff_role('+uuid(uids.admin)+'); ROLLBACK;',true);
  check('B200_'+role.toUpperCase()+'_SQL_DIRECT_CALL_DENIED',
   /permission denied/i.test(result.stderr),{message:result.stderr.slice(0,120)});
 }
 for(const name of [null,'recruiterA','admin']){
  const result=await apiPrivate(name,tokens);
  check('B200_'+(name===null?'ANON':name.toUpperCase())+'_HTTP_PRIVATE_FUNCTION_NOT_EXPOSED',
   [404,406].includes(result.status),result);
 }
 const recruiter=await query('recruiterA','candidates');
 check('B200_BROWSER_RECRUITER_RLS_UNCHANGED',
  recruiter.status===200&&recruiter.count===2,recruiter);
 const finance=await query('finance','candidates');
 check('B200_BROWSER_FINANCE_CANDIDATES_DENIED',
  finance.status===200&&finance.count===0,finance);
 const fullRls=select("SELECT (count(*)=35)::text FROM pg_catalog.pg_policies WHERE schemaname='public'");
 check('B200_35_POLICY_COUNT_UNCHANGED',fullRls==='true',{fullRls});
 const privatePolicies=select("SELECT (count(*)=0)::text FROM pg_catalog.pg_policies WHERE schemaname='b200_review_internal'");
 check('B200_NO_PRIVATE_SCHEMA_POLICIES',privatePolicies==='true',{privatePolicies});
 assert.equal(cases,30,'Build200 requires 30 independently checked assertions');
 console.log('BUILD200_30_OF_30_PRIVATE_SERVICE_DESIGN_CASES_PASS_DISPOSABLE_ONLY');
 console.log('BUILD200_SERVICE_ALTERNATIVE_UNAPPROVED_NO_AUDITED_SERVER_ROUTE');
}
