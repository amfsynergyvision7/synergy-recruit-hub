/**
 * Build189 ephemeral GoTrue-issued JWT to PostgREST protected role helper.
 * Runs only under CI with disposable PG17/PostgREST, not a hosted Supabase API.
 * All emails, passwords, identities and role data are fictional.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
const gate=process.env.B189_CI_DISPOSABLE_ONLY==='true'&&
 process.env.PGHOST==='127.0.0.1'&&process.env.PGDATABASE==='postgres'&&
 process.env.B189_JWT_SECRET?.length>=32;
assert.ok(gate,'Build189 refuses any non-disposable execution environment');
const auth='http://127.0.0.1:9999',rest='http://127.0.0.1:3000';
const names=['admin','recruiter','finance','unassigned'];
const tokens=new Map(),uuids=new Map();
const password='Build189_Disposable_Auth_Test_8Pz7nJ';
async function fetchJson(url,options={}){
 const x=await fetch(url,{signal:AbortSignal.timeout(9000),...options});
 let body;const raw=await x.text();try{body=JSON.parse(raw)}catch{body=raw}
 return{status:x.status,body};
}
for(const [index,name] of names.entries()){
 const email='build189-fictional-'+name+'-'+String(index+1)+'@example.com';
 const signup=await fetchJson(auth+'/signup',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password,data:{test_only:'build189-disposable'}})
 });
 assert.ok([200,201].includes(signup.status),
 'Disposable GoTrue signup failed '+name+' '+signup.status+' '+JSON.stringify(signup.body).slice(0,200));
 const id=signup.body?.user?.id??signup.body?.id;
 assert.match(String(id),/^[a-f0-9-]{36}$/i);
 const login=await fetchJson(auth+'/token?grant_type=password',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password})
 });
 assert.equal(login.status,200,'Disposable GoTrue sign-in failed '+name+' '+JSON.stringify(login.body).slice(0,130));
 const token=login.body?.access_token;
 assert.ok(typeof token==='string'&&token.split('.').length===3);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.sub,id,'GoTrue JWT subject mismatch');
 assert.equal(claims.role,'authenticated','GoTrue JWT does not have expected role');
 assert.ok(Number(claims.exp)>Math.floor(Date.now()/1000),'GoTrue JWT already expired');
 uuids.set(name,id);tokens.set(name,token);
}
assert.equal(tokens.size,4);
console.log('BUILD189_GOTRUE_ISSUED_FOUR_FICTIONAL_USERS');
// Insert only three fictional app-role assignments against disposable PG17.
// The fourth GoTrue user remains deliberately unassigned.
const sql="INSERT INTO public.user_roles(user_id,role) VALUES "+
 ["admin","recruiter","finance"].map(name=>"('"+uuids.get(name)+"'::uuid,'"+name+"'::public.app_role)").join(',')+";";
const insert=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1',
 '-h','127.0.0.1','-U','postgres','-d','postgres','-c',sql],
 {env:process.env,encoding:'utf8',timeout:15000});
if(insert.status!==0)throw Error('Disposable role fixture setup failed: '+String(insert.stderr).slice(0,240));

async function http(path,token,method='GET',input){
 const headers={Accept:'application/json'};
 if(token!==null)headers.Authorization='Bearer '+token;
 if(input!==undefined)headers['Content-Type']='application/json';
 return await fetchJson(rest+path,{method,headers,
  body:input===undefined?undefined:JSON.stringify(input)});
}
async function rpc(caller,subject,role){
 const v=await http('/rpc/has_role',caller===null?null:tokens.get(caller),'POST',{_user_id:uuids.get(subject),_role:role});
 return{status:v.status,result:v.body};
}
async function rows(caller,table,column='id'){
 const v=await http('/'+table+'?select='+encodeURIComponent(column),
  caller===null?null:tokens.get(caller));
 return{status:v.status,count:Array.isArray(v.body)?v.body.length:null};
}
let ready=false;
for(let i=0;i<40;i++){
 const v=await rows('admin','audit_probe');
 if(v.status===200){ready=true;break}
 await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(ready,'PostgREST not ready with an issued GoTrue token');
const cases=[];
function check(key,actual,expected){
 const pass=typeof expected==='function'?expected(actual):isDeepStrictEqual(actual,expected);
 cases.push({id:key,pass});
 if(!pass)throw Error('BUILD189_FAILED '+key+' observed '+JSON.stringify(actual).slice(0,220));
 console.log('BUILD189_HTTP_PASS '+key);
}
check('ADMIN_OWN_ROLE',await rpc('admin','admin','admin'),{status:200,result:true});
check('ADMIN_CROSS_RECRUITER_FALSE',await rpc('admin','recruiter','recruiter'),{status:200,result:false});
check('ADMIN_CROSS_FINANCE_FALSE',await rpc('admin','finance','finance'),{status:200,result:false});
check('ADMIN_INCORRECT_ROLE_FALSE',await rpc('admin','admin','recruiter'),{status:200,result:false});
const nullTarget=await http('/rpc/has_role',tokens.get('admin'),'POST',{_user_id:null,_role:'admin'});
check('GOTRUE_NULL_USER_ID_BOOLEAN_FALSE',{status:nullTarget.status,result:nullTarget.body},{status:200,result:false});
check('ADMIN_AUDIT_RLS',await rows('admin','audit_probe'),{status:200,count:1});
check('ADMIN_CANDIDATE_RLS',await rows('admin','candidate_probe'),{status:200,count:1});
check('RECRUITER_OWN_ROLE',await rpc('recruiter','recruiter','recruiter'),{status:200,result:true});
check('RECRUITER_NOT_ADMIN',await rpc('recruiter','recruiter','admin'),{status:200,result:false});
check('RECRUITER_CROSS_ADMIN_FALSE',await rpc('recruiter','admin','admin'),{status:200,result:false});
check('RECRUITER_AUDIT_DENIED',await rows('recruiter','audit_probe'),{status:200,count:0});
check('RECRUITER_CANDIDATE_RLS',await rows('recruiter','candidate_probe'),{status:200,count:1});
check('FINANCE_OWN_ROLE',await rpc('finance','finance','finance'),{status:200,result:true});
check('FINANCE_NOT_ADMIN',await rpc('finance','finance','admin'),{status:200,result:false});
check('FINANCE_CROSS_RECRUITER_FALSE',await rpc('finance','recruiter','recruiter'),{status:200,result:false});
check('FINANCE_AUDIT_DENIED',await rows('finance','audit_probe'),{status:200,count:0});
check('FINANCE_CANDIDATE_DENIED',await rows('finance','candidate_probe'),{status:200,count:0});
check('UNASSIGNED_OWN_FALSE',await rpc('unassigned','unassigned','admin'),{status:200,result:false});
check('UNASSIGNED_CROSS_ADMIN_FALSE',await rpc('unassigned','admin','admin'),{status:200,result:false});
check('UNASSIGNED_AUDIT_DENIED',await rows('unassigned','audit_probe'),{status:200,count:0});
check('UNASSIGNED_CANDIDATE_DENIED',await rows('unassigned','candidate_probe'),{status:200,count:0});
const denied=x=>[401,403].includes(x.status)&&x.result!==true;
const anon=await http('/rpc/has_role',null,'POST',{_user_id:uuids.get('admin'),_role:'admin'});
check('ANONYMOUS_RPC_DENIED',{status:anon.status,result:anon.body},denied);
const anonAudit=await http('/audit_probe?select=id',null);
check('ANONYMOUS_AUDIT_DENIED',{status:anonAudit.status},x=>[401,403].includes(x.status));
const token=tokens.get('admin'),tampered=token.slice(0,-7)+'invalid';
const bad=await http('/rpc/has_role',tampered,'POST',{_user_id:uuids.get('admin'),_role:'admin'});
check('TAMPERED_GOTRUE_TOKEN_DENIED',{status:bad.status,result:bad.body},denied);
const malformed=await http('/rpc/has_role','not.a.real.jwt','POST',{_user_id:uuids.get('admin'),_role:'admin'});
check('MALFORMED_TOKEN_DENIED',{status:malformed.status,result:malformed.body},denied);
const direct=await rows('admin','user_roles','user_id');
check('DIRECT_USER_ROLES_READ_DENIED',direct,x=>[401,403].includes(x.status));
check('AUTHENTICATED_SUBJECT_MISMATCH',await rpc('admin','finance','finance'),{status:200,result:false});
assert.equal(cases.length,27);
assert.equal(cases.filter(x=>x.pass).length,27);
console.log('BUILD194_GOTRUE_ISSUED_JWT_HTTP_27_OF_27_PASS_DISPOSABLE_ONLY');
