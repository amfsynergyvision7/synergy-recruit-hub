/** Build188: synthetic HMAC JWT -> disposable PostgREST RPC + real RLS SELECT.
 * No GoTrue, hosted Supabase, business rows, external communications or CRM.
 */
import {createHmac} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';

const secret=process.env.B188_JWT_SECRET;
assert.ok(typeof secret==='string'&&secret.length>=32);
const base='http://127.0.0.1:3000';
const ids={
 admin:'11111111-1111-4111-8111-111111111111',
 recruiter:'22222222-2222-4222-8222-222222222222',
 finance:'33333333-3333-4333-8333-333333333333',
 unassigned:'44444444-4444-4444-8444-444444444444'
};
const now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function sign(sub,opts={}){
 const claims={role:'authenticated',iat:now-10,exp:now+3600};
 if(sub!==null)claims.sub=sub;
 Object.assign(claims,opts);
 const unsigned=enc({typ:'JWT',alg:'HS256'})+'.'+enc(claims);
 return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
}
const tokens={
 admin:sign(ids.admin),recruiter:sign(ids.recruiter),
 finance:sign(ids.finance),unassigned:sign(ids.unassigned),
 missing:sign(null),service:sign(null,{role:'service_role'}),
 expired:sign(ids.admin,{iat:now-7200,exp:now-3600}),
 malformed:'not.a.signed.jwt',
 tampered:sign(ids.admin).slice(0,-7)+'tampered'
};
async function http(path,token=null,method='GET',data=null){
 const headers={Accept:'application/json'};
 if(token!==null)headers.Authorization='Bearer '+token;
 if(data!==null)headers['Content-Type']='application/json';
 const res=await fetch(base+path,{method,headers,
  body:data===null?undefined:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
 const raw=await res.text();
 let body;try{body=JSON.parse(raw)}catch{body=raw}
 return {status:res.status,body};
}
const cases=[];
function check(label,got,expected){
 const ok=typeof expected==='function'?expected(got):isDeepStrictEqual(got,expected);
 cases.push({label,ok});
 if(!ok)throw Error('Build188 HTTP FAIL '+label+' got '+JSON.stringify(got).slice(0,320));
 console.log('BUILD188_HTTP_PASS '+label);
}
const rpc=async(token,user,role)=>{
 const x=await http('/rpc/has_role',token,'POST',{_user_id:user,_role:role});
 return {status:x.status,value:x.body};
};
const rows=async(table,token,projection='id')=>{
 const x=await http('/'+table+'?select='+encodeURIComponent(projection),token);
 return {status:x.status,count:Array.isArray(x.body)?x.body.length:-1};
};
for(let k=0;k<30;k++){
 const ready=await rows('audit_probe',tokens.admin);
 if(ready.status===200)break;
 if(k===29)throw Error('PostgREST schema did not become ready');
 await new Promise(resolve=>setTimeout(resolve,400));
}
check('ADMIN_SELF_ROLE',await rpc(tokens.admin,ids.admin,'admin'),{status:200,value:true});
check('ADMIN_CROSS_USER_RECRUITER_DENIED',await rpc(tokens.admin,ids.recruiter,'recruiter'),{status:200,value:false});
check('ADMIN_OTHER_ROLE_DENIED',await rpc(tokens.admin,ids.admin,'recruiter'),{status:200,value:false});
check('ADMIN_NULL_USER_ID_BOOLEAN_FALSE',await rpc(tokens.admin,null,'admin'),{status:200,value:false});
check('ADMIN_AUDIT_VIEW',await rows('audit_probe',tokens.admin),{status:200,count:1});
check('ADMIN_CANDIDATE_VIEW',await rows('candidate_probe',tokens.admin),{status:200,count:1});
check('RECRUITER_SELF_ROLE',await rpc(tokens.recruiter,ids.recruiter,'recruiter'),{status:200,value:true});
check('RECRUITER_CANNOT_ENUMERATE_ADMIN',await rpc(tokens.recruiter,ids.admin,'admin'),{status:200,value:false});
check('RECRUITER_NOT_ADMIN',await rpc(tokens.recruiter,ids.recruiter,'admin'),{status:200,value:false});
check('RECRUITER_AUDIT_DENIED',await rows('audit_probe',tokens.recruiter),{status:200,count:0});
check('RECRUITER_CANDIDATE_VIEW',await rows('candidate_probe',tokens.recruiter),{status:200,count:1});
check('FINANCE_SELF_ROLE',await rpc(tokens.finance,ids.finance,'finance'),{status:200,value:true});
check('FINANCE_NOT_ADMIN',await rpc(tokens.finance,ids.finance,'admin'),{status:200,value:false});
check('FINANCE_AUDIT_DENIED',await rows('audit_probe',tokens.finance),{status:200,count:0});
check('FINANCE_CANDIDATE_DENIED',await rows('candidate_probe',tokens.finance),{status:200,count:0});
check('NO_ROLE_FALSE',await rpc(tokens.unassigned,ids.unassigned,'admin'),{status:200,value:false});
check('NO_ROLE_AUDIT_DENIED',await rows('audit_probe',tokens.unassigned),{status:200,count:0});
for(const [name,token] of [
 ['ANON',null],['MALFORMED',tokens.malformed],
 ['TAMPERED',tokens.tampered],['EXPIRED',tokens.expired]
]){
 const response=await rpc(token,ids.admin,'admin');
 check(name+'_RPC_DENIED',response,x=>[401,403].includes(x.status)&&x.value!==true);
}
check('ANON_AUDIT_DENIED',await rows('audit_probe',null),x=>[401,403].includes(x.status));
const missing=await rpc(tokens.missing,ids.admin,'admin');
check('SIGNED_MISSING_SUBJECT_NO_ROLE',missing,
 x=>(x.status===200&&x.value===false)||[401,403].includes(x.status));
const service=await rpc(tokens.service,ids.admin,'admin');
check('SERVICE_ROLE_WITHOUT_USER_FALSE',service,x=>x.status===200&&x.value===false);
check('MISMATCHED_SUB_DENIED',await rpc(tokens.admin,ids.finance,'finance'),{status:200,value:false});
check('NO_DIRECT_USER_ROLE_TABLE_SELECT',await rows('user_roles',tokens.admin,'user_id'),x=>[401,403].includes(x.status));
assert.equal(cases.length,26);
assert.equal(cases.filter(x=>x.ok).length,26);
console.log('BUILD194_SIGNED_POSTGREST_RPC_26_OF_26_PASS_SYNTHETIC_ONLY');
