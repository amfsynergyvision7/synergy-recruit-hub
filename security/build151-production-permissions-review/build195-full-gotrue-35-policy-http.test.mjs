/**
 * Build195: actual locally GoTrue-issued JWT -> PostgREST -> 35 exact PR16
 * RLS policies + corrected exact PR23 has_role. Fictional rows only.
 * No hosted Supabase, real candidate, CRM, email, financial effect or user.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runBuild196} from './build196-role-revocation.disposable.mjs';
import {runBuild198} from './build198-real-role-rpc.disposable.mjs';
import {runBuild199} from './build199-combined-candidates.disposable.mjs';
import {runBuild200} from './build200-private-service-alternative.disposable.mjs';
const env=process.env;
assert(env.B195_DISPOSABLE_ONLY==='true'&&env.PGHOST==='127.0.0.1'&&
 env.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&env.PGUSER==='postgres'&&
 env.B195_JWT_SECRET?.length>=32,'Refusing non-disposable integration test');
const rest='http://127.0.0.1:3000',auth='http://127.0.0.1:9999';
const who=['admin','recruiterA','recruiterB','finance','pending'];
const tokens={},uids={};
const pw='build195_synthetic_password_Mp3!45';
async function http(url,opts={}){
 const x=await fetch(url,{signal:AbortSignal.timeout(9000),...opts});
 let result;const body=await x.text();
 try{result=JSON.parse(body)}catch{result=body}
 return {status:x.status,result};
}
for(const [i,name] of who.entries()){
 const email='build195-'+name.toLowerCase()+'-'+i+'@example.com';
 const signup=await http(auth+'/signup',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password:pw,data:{disposable_only:true}})});
 assert.ok([200,201].includes(signup.status),'Fictional GoTrue signup '+name+' '+signup.status);
 const id=signup.result?.user?.id??signup.result?.id;
 assert.match(String(id),/^[a-f0-9-]{36}$/i);
 const login=await http(auth+'/token?grant_type=password',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
 assert.equal(login.status,200,'Fictional login '+name+' '+JSON.stringify(login.result).slice(0,180));
 const token=login.result?.access_token;
 assert.equal(typeof token,'string');
 assert.equal(token.split('.').length,3);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.sub,id);
 assert.equal(claims.role,'authenticated');
 assert.ok(claims.exp>Math.floor(Date.now()/1000));
 tokens[name]=token;uids[name]=id;
}
console.log('BUILD195_FIVE_GOTRUE_ISSUED_FICTIONAL_JWTS');
const q=v=>"'"+v+"'",uuid=x=>q(x)+"::uuid";
const insert=[
 ...who.map((name,i)=>{
  const approved=name!=='pending';
  return "INSERT INTO public.profiles(id,full_name,status,is_active) VALUES("+
   uuid(uids[name])+","+q('fictional '+name)+","+q(approved?'approved':'pending')+
   "::public.user_status,"+(approved?'true':'false')+");";
 }),
 ...who.map((name,i)=>{
  const role=name.startsWith('recruiter')?'recruiter':name==='pending'?'admin':name;
  const fakeid='a1000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
  return "INSERT INTO public.user_roles(id,user_id,role) VALUES("+
    uuid(fakeid)+","+uuid(uids[name])+","+q(role)+"::public.app_role);";
 }),
 "INSERT INTO public.candidates(id,assigned_recruiter,stage,full_name) VALUES"+
 "('c1000000-0000-4000-8000-000000000001',"+uuid(uids.recruiterA)+",'lead_received','fictional candidate A'),"+
 "('c1000000-0000-4000-8000-000000000002',"+uuid(uids.recruiterB)+",'lead_received','fictional candidate B');",
 "INSERT INTO public.job_openings(id,assigned_recruiter,job_title) VALUES"+
 "('d1000000-0000-4000-8000-000000000001',"+uuid(uids.recruiterA)+",'fictional job A'),"+
 "('d1000000-0000-4000-8000-000000000002',"+uuid(uids.recruiterB)+",'fictional job B');",
 "INSERT INTO public.billing(id,invoice_number) VALUES('b1000000-0000-4000-8000-000000000001','fictional invoice');",
 "INSERT INTO public.audit_logs(id,action,table_name) VALUES('e1000000-0000-4000-8000-000000000001','fictional_event','fictional_table');",
 "INSERT INTO public.notifications(id,user_id,title,is_read) VALUES"+
 "('f1000000-0000-4000-8000-000000000001',"+uuid(uids.recruiterA)+",'fictional own notification',false),"+
 "('f1000000-0000-4000-8000-000000000002',"+uuid(uids.recruiterB)+",'fictional other notification',false);",
 "INSERT INTO public.submissions(id,candidate_uuid,status) VALUES"+
 "('61000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','submitted'),"+
 "('61000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','submitted');",
 "INSERT INTO public.interviews(id,candidate_uuid,status) VALUES"+
 "('71000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','scheduled'),"+
 "('71000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','scheduled');",
 "INSERT INTO public.candidate_stage_history(id,candidate_id,new_stage) VALUES"+
 "('81000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','submitted'),"+
 "('81000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','submitted');",
 "INSERT INTO public.offers(id,candidate_uuid,offer_status) VALUES('91000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','offered');",
 "INSERT INTO public.clients(id,company_name) VALUES('a2000000-0000-4000-8000-000000000001','fictional client');",
 "INSERT INTO public.app_settings(id,logo_url,default_color_theme,resume_import_folder_url) VALUES(1,'fictional.svg','light','secret-fictional-folder');"
].join('\n');
const db=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-c',insert],
 {env,encoding:'utf8',timeout:20000});
assert.equal(db.status,0,'PG17 synthetic-only seed '+String(db.stderr).slice(0,350));
console.log('BUILD195_FICTIONAL_ONLY_SEED_IN_DISPOSABLE_DATABASE');
async function query(name,table,projection='id',filter=''){
 const hdr={Accept:'application/json'};
 if(name!==null)hdr.Authorization='Bearer '+tokens[name];
 const url=rest+'/'+table+'?select='+encodeURIComponent(projection)+filter;
 const x=await http(url,{headers:hdr});
 return {status:x.status,count:Array.isArray(x.result)?x.result.length:null,body:x.result};
}
async function rpc(name,userId,role){
 const hdr={Accept:'application/json','Content-Type':'application/json'};
 if(name!==null)hdr.Authorization='Bearer '+tokens[name];
 const x=await http(rest+'/rpc/has_role',{method:'POST',headers:hdr,
  body:JSON.stringify({_user_id:userId,_role:role})});
 return x;
}
async function mutation(name,method,table,record,filter=''){
 const x=await http(rest+'/'+table+filter,{method,headers:{
  Authorization:'Bearer '+tokens[name],
  Accept:'application/json','Content-Type':'application/json',
  Prefer:'return=minimal'},body:JSON.stringify(record)});
 return x;
}
const outcomes=[];
function yes(key,condition,actual){
 const ok=Boolean(condition);
 outcomes.push({key,ok});
 if(!ok)throw new Error('BUILD195_HTTP_FAIL '+key+' '+JSON.stringify(actual).slice(0,240));
 console.log('BUILD195_HTTP_PASS '+key);
}
for(let i=0;i<35;i++){
 const x=await query('admin','candidates');
 if(x.status===200)break;
 if(i===34)throw new Error('PostgREST schema not ready '+JSON.stringify(x).slice(0,190));
 await new Promise(resolve=>setTimeout(resolve,450));
}
const roleProbe=await rpc('admin',uids.admin,'admin');
const approvalProbe=await http(rest+'/rpc/is_approved',{method:'POST',
 headers:{Authorization:'Bearer '+tokens.admin,
 'Content-Type':'application/json',Accept:'application/json'},
 body:JSON.stringify({_user_id:uids.admin})});
const profileProbe=await query('admin','profiles');
const rolesProbe=await query('admin','user_roles');
console.log('BUILD195_FICTIONAL_AUTH_DIAGNOSTIC '+JSON.stringify({
 roleStatus:roleProbe.status,roleValue:roleProbe.result,
 approvalStatus:approvalProbe.status,approvalValue:approvalProbe.result,
 profileStatus:profileProbe.status,profileCount:profileProbe.count,
 userRolesStatus:rolesProbe.status,userRolesCount:rolesProbe.count
}));
yes('GOTRUE_ISSUED_JWT_RESOLVES_CURRENT_USER_ROLE',
 roleProbe.status===200&&roleProbe.result===true,roleProbe);
yes('GOTRUE_ISSUED_JWT_APPROVED_PROFILE',
 approvalProbe.status===200&&approvalProbe.result===true,approvalProbe);
yes('GOTRUE_SUBJECT_SELF_PROFILE_VISIBLE',
 profileProbe.status===200&&profileProbe.count===5,profileProbe);
for(const [role,table,expected] of [
 ['admin','candidates',2],['admin','job_openings',2],
 ['admin','billing',1],['admin','audit_logs',1],
 ['admin','profiles',5],['admin','user_roles',5],
 ['admin','submissions',2],['admin','interviews',2],
 ['admin','offers',1],['admin','candidate_stage_history',2],
 ['recruiterA','candidates',1],['recruiterA','job_openings',1],
 ['recruiterA','billing',0],['recruiterA','audit_logs',0],
 ['recruiterA','submissions',1],['recruiterA','interviews',1],
 ['recruiterA','candidate_stage_history',1],['recruiterA','notifications',1],
 ['recruiterA','user_roles',1],
 ['recruiterB','candidates',1],['recruiterB','job_openings',1],
 ['recruiterB','submissions',1],['recruiterB','notifications',1],
 ['finance','billing',1],['finance','candidates',0],
 ['finance','job_openings',0],['finance','audit_logs',0],
 ['pending','candidates',0],['pending','billing',0],
 ['pending','audit_logs',0],['pending','profiles',1],
 ['pending','user_roles',1]
]){
 const x=await query(role,table);
 yes(role.toUpperCase()+'_'+table.toUpperCase()+'_COUNT_'+expected,x.status===200&&x.count===expected,x);
}
for(const [actor,subject,role,expected] of [
 ['admin','admin','admin',true],['admin','recruiterA','recruiter',false],
 ['recruiterA','recruiterA','recruiter',true],
 ['recruiterA','admin','admin',false],
 ['finance','finance','finance',true],['pending','pending','admin',true]
]){
 const x=await rpc(actor,uids[subject],role);
 yes('RPC_'+actor+'_'+subject+'_'+role,x.status===200&&x.result===expected,x);
}
const nullid=await rpc('admin',null,'admin');
yes('NULL_ROLE_TARGET_STRICT_FALSE',nullid.status===200&&nullid.result===false,nullid);
for(const table of ['candidates','audit_logs','billing','user_roles']){
 const x=await query(null,table);
 yes('ANON_'+table.toUpperCase()+'_DENIED',[401,403].includes(x.status),x);
}
const branding=await query(null,'app_settings','id,logo_url,default_color_theme');
yes('ANON_PUBLIC_BRANDING_FIELDS',branding.status===200&&branding.count===1,branding);
const privateBrand=await query(null,'app_settings','resume_import_folder_url');
yes('ANON_PRIVATE_BRANDING_DENIED',[401,403].includes(privateBrand.status),privateBrand);
const tampered=tokens.admin.slice(0,-7)+'tampered';
const bad=await http(rest+'/candidates?select=id',{headers:{Authorization:'Bearer '+tampered}});
yes('GOTRUE_TAMPERED_JWT_REJECTED',[401,403].includes(bad.status),bad);
const own=await mutation('recruiterA','POST','candidates',{
 id:'c1000000-0000-4000-8000-000000000003',assigned_recruiter:uids.recruiterA,stage:'lead_received'});
yes('OWN_CANDIDATE_INSERT_ALLOWED',[200,201,204].includes(own.status),own);
const other=await mutation('recruiterA','POST','candidates',{
 id:'c1000000-0000-4000-8000-000000000004',assigned_recruiter:uids.recruiterB,stage:'lead_received'});
yes('FOREIGN_RECRUITER_INSERT_DENIED',[401,403].includes(other.status),other);
const updated=await mutation('recruiterA','PATCH','candidates',{stage:'contacted'},'?id=eq.c1000000-0000-4000-8000-000000000001');
yes('OWN_CANDIDATE_STAGE_UPDATE',[200,204].includes(updated.status),updated);
const after=await query('recruiterA','candidates','stage','&id=eq.c1000000-0000-4000-8000-000000000001');
yes('OWN_CANDIDATE_STAGE_UPDATED',after.status===200&&after.count===1&&after.body[0]?.stage==='contacted',after);
const reassign=await mutation('recruiterA','PATCH','candidates',{assigned_recruiter:uids.recruiterB},'?id=eq.c1000000-0000-4000-8000-000000000001');
yes('CANDIDATE_OWNER_REASSIGN_DENIED',[401,403].includes(reassign.status),reassign);
const notification=await mutation('recruiterA','PATCH','notifications',{is_read:true},'?id=eq.f1000000-0000-4000-8000-000000000001');
yes('OWN_NOTIFICATION_READ_UPDATE',[200,204].includes(notification.status),notification);
const recipient=await mutation('recruiterA','PATCH','notifications',{user_id:uids.recruiterB},'?id=eq.f1000000-0000-4000-8000-000000000001');
yes('NOTIFICATION_RECIPIENT_MUTATION_DENIED',[401,403].includes(recipient.status),recipient);
const roleMutation=await mutation('admin','POST','user_roles',{id:'a1000000-0000-4000-8000-000000000009',user_id:uids.pending,role:'finance'});
yes('BROWSER_ROLE_MUTATION_DENIED',[401,403].includes(roleMutation.status),roleMutation);
const sub=await mutation('recruiterA','POST','submissions',{id:'61000000-0000-4000-8000-000000000003',candidate_uuid:'c1000000-0000-4000-8000-000000000001'});
yes('RECRUITER_SUBMISSION_WRITE_DENIED',[401,403].includes(sub.status),sub);
const good=outcomes.filter(x=>x.ok).length;
assert.equal(outcomes.length,58,'Build195 58 expected HTTP authorization assertions');
assert.equal(good,58);
console.log('BUILD195_GOTRUE_FULL_35_POLICY_HTTP_'+good+'_OF_'+good+'_PASS_DISPOSABLE_ONLY');
await runBuild196({uids,query,rpc,mutation,yes});
const b196Good=outcomes.filter(x=>x.ok).length;
assert.equal(outcomes.length,85,'Build197 runs 58 baseline + 27 role revocation/notification read-write cases');
assert.equal(b196Good,85);
console.log('BUILD197_GOTRUE_FULL_35_POLICY_HTTP_85_OF_85_PASS_DISPOSABLE_ONLY');
await runBuild198({uids,tokens,query,yes});
const b198Total=outcomes.filter(x=>x.ok).length;
assert.equal(outcomes.length,112,'Build198 expects 85 baseline, 14 role and 13 approval cases');
assert.equal(b198Total,112);
console.log('BUILD198_GOTRUE_FULL_35_POLICY_HTTP_112_OF_112_PASS_DISPOSABLE_ONLY');
await runBuild199({uids,tokens,query,rpc,mutation,yes});
const b199Total=outcomes.filter(x=>x.ok).length;
assert.equal(outcomes.length,145,'Build199 expects 112 earlier plus 33 combined overlay/service cases');
assert.equal(b199Total,145);
console.log('BUILD199_GOTRUE_FULL_35_POLICY_HTTP_145_OF_145_PASS_DISPOSABLE_ONLY');
await runBuild200({uids,tokens,query,yes});
const b200Pass=outcomes.filter(x=>x.ok).length;
assert.equal(outcomes.length,175,'Build200 requires 145 previous plus 30 private service checks');
assert.equal(b200Pass,175);
console.log('BUILD200_GOTRUE_AND_SERVICE_PRIVATE_HTTP_175_OF_175_PASS_DISPOSABLE_ONLY');
